import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:motorix_client/services/api_client.dart';

/// Respuesta simulada de la API para las pruebas del frontend.
class FakeResponse {
  FakeResponse(this.status, this.body);

  final int status;
  final Object? body;
}

typedef FakeHandler = FakeResponse Function(http.Request request);

/// Crea un [ApiClient] que responde con [handler] en lugar de usar la red.
ApiClient fakeApi(FakeHandler handler, {List<http.Request>? log}) {
  final client = MockClient((request) async {
    log?.add(request);
    final response = handler(request);
    return http.Response(
      response.body == null ? '' : jsonEncode(response.body),
      response.status,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );
  });
  return ApiClient(httpClient: client, baseUrl: 'http://prueba/api');
}

Map<String, dynamic> userJson({String role = 'ADMIN', String username = 'admin', String name = 'Administrador'}) => {
      'id': 1,
      'username': username,
      'name': name,
      'email': '$username@motorix.local',
      'role': role,
      'active': true,
      'createdAt': '2026-10-12T10:00:00.000Z',
      'updatedAt': '2026-10-12T10:00:00.000Z',
    };

FakeResponse loginOk({String role = 'ADMIN', String username = 'admin'}) => FakeResponse(200, {
      'data': {'token': 'token-de-prueba', 'expiresIn': 28800, 'user': userJson(role: role, username: username)},
    });

FakeResponse apiError(int status, String code, String message, {List<Map<String, String>>? details}) =>
    FakeResponse(status, {
      'error': {'code': code, 'message': message, 'details': ?details},
    });

FakeResponse listaVacia() => FakeResponse(200, {
      'data': <Object>[],
      'meta': {'page': 1, 'pageSize': 10, 'total': 0},
    });
