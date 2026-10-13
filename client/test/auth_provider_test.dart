import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/models/user.dart';
import 'package:motorix_client/providers/auth_provider.dart';
import 'package:motorix_client/services/api_client.dart';

import 'helpers/fake_api.dart';

void main() {
  group('AuthProvider', () {
    test('inicia sesión con usuario o correo y guarda al usuario', () async {
      final requests = <http.Request>[];
      final auth = AuthProvider(fakeApi((_) => loginOk(role: 'RECEPTIONIST', username: 'recepcion'), log: requests));

      final ok = await auth.login('  recepcion@motorix.local ', 'Clave2026');

      expect(ok, isTrue, reason: 'el inicio de sesión debería ser exitoso');
      expect(auth.isAuthenticated, isTrue);
      expect(auth.user?.role, UserRole.receptionist);
      final body = jsonDecode(requests.single.body) as Map<String, dynamic>;
      expect(body['identifier'], 'recepcion@motorix.local', reason: 'debe recortar los espacios sobrantes');
    });

    test('muestra el mensaje en español cuando las credenciales son incorrectas', () async {
      final auth = AuthProvider(fakeApi((_) => apiError(401, 'UNAUTHENTICATED', 'Credenciales incorrectas.')));

      final ok = await auth.login('admin', 'mala');

      expect(ok, isFalse);
      expect(auth.isAuthenticated, isFalse);
      expect(auth.error, 'Credenciales incorrectas.');
    });

    test('cierra la sesión y borra al usuario', () async {
      final auth = AuthProvider(fakeApi((_) => loginOk()));
      await auth.login('admin', 'Clave2026');

      auth.logout();

      expect(auth.isAuthenticated, isFalse);
    });

    test('envía el token en las peticiones posteriores al inicio de sesión', () async {
      final requests = <http.Request>[];
      final api = fakeApi((request) {
        if (request.url.path.endsWith('/auth/login')) {
          return loginOk();
        }
        return FakeResponse(204, null);
      }, log: requests);
      final auth = AuthProvider(api);
      await auth.login('admin', 'Clave2026');

      await auth.changePassword('Clave2026', 'NuevaClave2026');

      expect(requests.last.headers['Authorization'], 'Bearer token-de-prueba');
    });

    test('cierra la sesión cuando el servidor responde 401 con la sesión iniciada', () async {
      var calls = 0;
      final api = fakeApi((request) {
        calls++;
        return calls == 1 ? loginOk() : apiError(401, 'UNAUTHENTICATED', 'Tu sesión no es válida.');
      });
      final auth = AuthProvider(api);
      await auth.login('admin', 'Clave2026');

      await expectLater(api.get('/clients'), throwsA(isA<ApiException>()));

      expect(auth.isAuthenticated, isFalse, reason: 'una sesión rechazada debe cerrarse');
      expect(auth.sessionExpired, isTrue);
    });

    test('expone los requisitos de contraseña que el servidor rechaza', () async {
      final api = fakeApi((request) {
        if (request.url.path.endsWith('/auth/login')) {
          return loginOk();
        }
        return apiError(400, 'VALIDATION_ERROR', 'Hay datos inválidos.', details: [
          {'field': 'newPassword', 'message': 'Debe incluir al menos un número.'},
        ]);
      });
      final auth = AuthProvider(api);
      await auth.login('admin', 'Clave2026');

      try {
        await auth.changePassword('Clave2026', 'SinNumeros');
        fail('debería lanzar una excepción');
      } on ApiException catch (e) {
        expect(e.fieldErrors['newPassword'], 'Debe incluir al menos un número.');
      }
    });
  });
}
