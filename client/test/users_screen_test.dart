import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Map<String, dynamic> usuario(int id, String username, String role, {bool active = true}) => {
      ...userJson(role: role, username: username, name: 'Nombre $username'),
      'id': id,
      'active': active,
    };

FakeResponse pagina(List<Map<String, dynamic>> items) => FakeResponse(200, {
      'data': items,
      'meta': {'page': 1, 'pageSize': 10, 'total': items.length},
    });

Future<void> abrirUsuarios(WidgetTester tester, FakeHandler handler, {List<http.Request>? log}) async {
  tester.view.physicalSize = const Size(1400, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final api = fakeApi((request) {
    if (request.url.path.endsWith('/auth/login')) {
      return loginOk(role: 'ADMIN');
    }
    return handler(request);
  }, log: log);
  await tester.pumpWidget(MotorixApp(api: api, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.widgetWithText(TextFormField, 'Usuario o correo electrónico'), 'admin');
  await tester.enterText(find.widgetWithText(TextFormField, 'Contraseña'), 'Clave2026');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Usuarios').first);
  await tester.pumpAndSettle();
}

FakeResponse usuarios(http.Request request) {
  if (request.url.path.endsWith('/users')) {
    return pagina([usuario(1, 'admin', 'ADMIN'), usuario(2, 'lucia', 'RECEPTIONIST')]);
  }
  return listaVacia();
}

void main() {
  testWidgets('el administrador ve la tabla de usuarios con su rol y estado', (tester) async {
    await abrirUsuarios(tester, usuarios);

    expect(find.text('lucia'), findsOneWidget);
    expect(find.text('Recepcionista'), findsWidgets);
    expect(find.text('Registrar usuario'), findsOneWidget);
  });

  testWidgets('no ofrece desactivar la propia cuenta', (tester) async {
    await abrirUsuarios(tester, usuarios);

    // Solo la fila de "lucia" tiene el botón de desactivar; la sesión es la de "admin".
    expect(find.byTooltip('Desactivar usuario'), findsOneWidget);
  });

  testWidgets('desactivar un usuario pide confirmación antes de llamar al servidor', (tester) async {
    final log = <http.Request>[];
    await abrirUsuarios(
      tester,
      (request) {
        if (request.method == 'PATCH') {
          return FakeResponse(200, {'data': usuario(2, 'lucia', 'RECEPTIONIST', active: false)});
        }
        return usuarios(request);
      },
      log: log,
    );

    await tester.tap(find.byTooltip('Desactivar usuario'));
    await tester.pumpAndSettle();
    expect(find.textContaining('¿Seguro que quieres desactivar al usuario lucia?'), findsOneWidget);

    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(log.where((r) => r.method == 'PATCH'), isEmpty, reason: 'al cancelar no se debe llamar al servidor');

    await tester.tap(find.byTooltip('Desactivar usuario'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();
    expect(log.where((r) => r.method == 'PATCH' && r.url.path.endsWith('/users/2/status')), hasLength(1));
    expect(find.text('Usuario desactivado.'), findsOneWidget);
  });

  testWidgets('el formulario de alta valida los campos y la política de contraseña', (tester) async {
    await abrirUsuarios(tester, usuarios);

    await tester.tap(find.text('Registrar usuario'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Contraseña inicial'), 'corta');
    await tester.tap(find.text('Guardar usuario'));
    await tester.pump();

    expect(find.text('El nombre de usuario es obligatorio.'), findsOneWidget);
    expect(find.text('El nombre es obligatorio.'), findsOneWidget);
    expect(find.text('El correo electrónico es obligatorio.'), findsOneWidget);
    expect(find.textContaining('Falta incluir:'), findsOneWidget);
  });

  testWidgets('muestra el mensaje del servidor cuando el usuario ya existe', (tester) async {
    await abrirUsuarios(tester, (request) {
      if (request.method == 'POST') {
        return apiError(409, 'CONFLICT', 'Ya existe un usuario con ese nombre de usuario.');
      }
      return usuarios(request);
    });

    await tester.tap(find.text('Registrar usuario'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Nombre de usuario'), 'lucia');
    await tester.enterText(find.widgetWithText(TextFormField, 'Nombre completo'), 'Lucía Ortiz');
    await tester.enterText(find.widgetWithText(TextFormField, 'Correo electrónico'), 'lucia@taller.test');
    await tester.enterText(find.widgetWithText(TextFormField, 'Contraseña inicial'), 'Clave2026Nueva');
    await tester.tap(find.text('Guardar usuario'));
    await tester.pumpAndSettle();

    expect(find.text('Ya existe un usuario con ese nombre de usuario.'), findsOneWidget);
  });
}
