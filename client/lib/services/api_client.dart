import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

/// Error de la API con un mensaje claro en español listo para mostrar al usuario.
class ApiException implements Exception {
  ApiException(this.message, {this.statusCode, this.code, this.fieldErrors = const {}});

  final String message;
  final int? statusCode;
  final String? code;

  /// Mensajes por campo (campo → mensaje) cuando el servidor rechaza datos inválidos.
  final Map<String, String> fieldErrors;

  bool get isUnauthorized => statusCode == 401;

  /// El servidor exige aceptar los términos y condiciones vigentes antes de continuar.
  bool get isTermsRequired => statusCode == 403 && code == 'TERMS_NOT_ACCEPTED';

  @override
  String toString() => message;
}

/// Cliente HTTP de la API de Motorix. Agrega el token y traduce los errores.
class ApiClient {
  ApiClient({http.Client? httpClient, String? baseUrl})
      : _http = httpClient ?? http.Client(),
        baseUrl = baseUrl ?? const String.fromEnvironment('API_URL', defaultValue: 'http://localhost:3000/api');

  final http.Client _http;
  final String baseUrl;

  String? _token;

  /// Se invoca cuando el servidor responde 401 con una sesión iniciada (token vencido o inválido).
  void Function()? onUnauthorized;

  /// Se invoca cuando el servidor responde 403 `TERMS_NOT_ACCEPTED` con una sesión iniciada: hay que mostrar los términos.
  void Function()? onTermsRequired;

  void setToken(String? token) => _token = token;

  Future<dynamic> get(String path, {Map<String, String?> query = const {}}) =>
      _send('GET', path, query: query);

  Future<dynamic> post(String path, {Object? body}) => _send('POST', path, body: body);

  Future<dynamic> put(String path, {Object? body}) => _send('PUT', path, body: body);

  Future<dynamic> patch(String path, {Object? body}) => _send('PATCH', path, body: body);

  Future<dynamic> delete(String path, {Object? body}) => _send('DELETE', path, body: body);

  /// Descarga un archivo (por ejemplo, un reporte en CSV) y devuelve sus bytes tal como llegan, con su marca BOM. Los
  /// errores del servidor llegan como JSON y se traducen igual que en las demás llamadas.
  Future<List<int>> download(String path, {Map<String, String?> query = const {}}) async {
    final response = await _sendRaw('GET', path, query: query, accept: '*/*');
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.bodyBytes;
    }
    dynamic decoded;
    try {
      decoded = jsonDecode(utf8.decode(response.bodyBytes));
    } catch (_) {
      throw ApiException('El servidor devolvió una respuesta inesperada.', statusCode: response.statusCode);
    }
    throw _exceptionFor(response, decoded);
  }

  Future<dynamic> _send(String method, String path,
      {Map<String, String?> query = const {}, Object? body}) async {
    final response = await _sendRaw(method, path, query: query, body: body);

    if (response.statusCode == 204 || response.body.isEmpty) {
      return null;
    }

    dynamic decoded;
    try {
      decoded = jsonDecode(utf8.decode(response.bodyBytes));
    } catch (_) {
      throw ApiException('El servidor devolvió una respuesta inesperada.', statusCode: response.statusCode);
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return decoded;
    }
    throw _exceptionFor(response, decoded);
  }

  Future<http.Response> _sendRaw(String method, String path,
      {Map<String, String?> query = const {}, Object? body, String accept = 'application/json'}) async {
    final params = {
      for (final entry in query.entries)
        if (entry.value != null && entry.value!.isNotEmpty) entry.key: entry.value!,
    };
    final uri = Uri.parse('$baseUrl$path').replace(queryParameters: params.isEmpty ? null : params);
    final headers = <String, String>{
      'Accept': accept,
      if (body != null) 'Content-Type': 'application/json',
      if (_token != null) 'Authorization': 'Bearer $_token',
    };

    late http.Response response;
    try {
      final request = http.Request(method, uri)..headers.addAll(headers);
      if (body != null) {
        request.body = jsonEncode(body);
      }
      response = await http.Response.fromStream(
        await _http.send(request).timeout(const Duration(seconds: 15)),
      );
    } on TimeoutException {
      throw ApiException('El servidor tardó demasiado en responder. Inténtalo de nuevo.');
    } catch (_) {
      throw ApiException('No se pudo conectar con el servidor. Verifica que esté en ejecución.');
    }
    return response;
  }

  // Traduce una respuesta de error a un [ApiException] y avisa si la sesión o los términos lo exigen.
  ApiException _exceptionFor(http.Response response, dynamic decoded) {
    final error = decoded is Map<String, dynamic> ? decoded['error'] : null;
    final message = error is Map && error['message'] is String
        ? error['message'] as String
        : 'Ocurrió un error inesperado.';
    final fieldErrors = <String, String>{};
    if (error is Map && error['details'] is List) {
      for (final detail in error['details'] as List) {
        if (detail is Map && detail['field'] is String && detail['message'] is String) {
          fieldErrors[detail['field'] as String] = detail['message'] as String;
        }
      }
    }
    final exception = ApiException(
      message,
      statusCode: response.statusCode,
      code: error is Map ? error['code'] as String? : null,
      fieldErrors: fieldErrors,
    );
    if (exception.isUnauthorized && _token != null) {
      onUnauthorized?.call();
    }
    if (exception.isTermsRequired && _token != null) {
      onTermsRequired?.call();
    }
    return exception;
  }
}
