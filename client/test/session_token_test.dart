import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:motorix_client/services/api_client.dart';

/// Servidor falso que entrega un token nuevo en la cabecera al cambiar la contraseña y recuerda el que recibe.
({ApiClient api, List<String?> usados}) preparar() {
  final usados = <String?>[];
  final api = ApiClient(
    httpClient: MockClient((request) async {
      usados.add(request.headers['Authorization']);
      if (request.url.path.endsWith('/auth/password')) {
        return http.Response('', 204, headers: {'x-auth-token': 'token-nuevo'});
      }
      return http.Response(jsonEncode({'data': {}}), 200, headers: {'content-type': 'application/json'});
    }),
  );
  return (api: api, usados: usados);
}

void main() {
  test('tras cambiar la contraseña las siguientes peticiones usan el token nuevo', () async {
    final (:api, :usados) = preparar();
    api.setToken('token-anterior');

    await api.put('/auth/password', body: {});
    await api.get('/auth/me');

    expect(usados, ['Bearer token-anterior', 'Bearer token-nuevo']);
  });

  test('sin una sesión abierta la cabecera se ignora', () async {
    final (:api, :usados) = preparar();

    await api.put('/auth/password', body: {});
    await api.get('/auth/me');

    expect(usados.last, isNull);
  });
}
