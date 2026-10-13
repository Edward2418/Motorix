import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

FakeHandler conLogin(FakeResponse login) => (request) {
      if (request.url.path.endsWith('/auth/login')) {
        return login;
      }
      return listaVacia();
    };

Future<void> abrirApp(WidgetTester tester, FakeHandler handler) async {
  tester.view.physicalSize = const Size(1400, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(MotorixApp(api: fakeApi(handler), useGoogleFonts: false));
  await tester.pumpAndSettle();
}

Future<void> iniciarSesion(WidgetTester tester, String usuario) async {
  await tester.enterText(find.widgetWithText(TextFormField, 'Usuario o correo electrónico'), usuario);
  await tester.enterText(find.widgetWithText(TextFormField, 'Contraseña'), 'Clave2026');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('muestra un solo campo para usuario o correo y valida los campos vacíos', (tester) async {
    await abrirApp(tester, conLogin(loginOk()));

    expect(find.text('Usuario o correo electrónico'), findsOneWidget);

    await tester.tap(find.text('Iniciar sesión'));
    await tester.pump();

    expect(find.text('Ingresa tu usuario o correo electrónico.'), findsOneWidget);
    expect(find.text('Ingresa tu contraseña.'), findsOneWidget);
  });

  testWidgets('muestra el error en español cuando las credenciales son incorrectas', (tester) async {
    await abrirApp(tester, (_) => apiError(401, 'UNAUTHENTICATED', 'Credenciales incorrectas.'));

    await iniciarSesion(tester, 'admin');

    expect(find.text('Credenciales incorrectas.'), findsOneWidget);
    expect(find.text('Iniciar sesión'), findsWidgets, reason: 'debe seguir en la pantalla de inicio de sesión');
  });

  testWidgets('el administrador ve Clientes, Vehículos y Usuarios en el menú', (tester) async {
    await abrirApp(tester, conLogin(loginOk(role: 'ADMIN')));

    await iniciarSesion(tester, 'admin');

    expect(find.text('Clientes'), findsWidgets);
    expect(find.text('Vehículos'), findsWidgets);
    expect(find.text('Usuarios'), findsWidgets);
  });

  testWidgets('el recepcionista no ve la entrada Usuarios', (tester) async {
    await abrirApp(tester, conLogin(loginOk(role: 'RECEPTIONIST', username: 'recepcion')));

    await iniciarSesion(tester, 'recepcion');

    expect(find.text('Clientes'), findsWidgets);
    expect(find.text('Usuarios'), findsNothing, reason: 'Usuarios solo es visible para ADMIN');
  });

  testWidgets('el mecánico no ve la entrada Usuarios', (tester) async {
    await abrirApp(tester, conLogin(loginOk(role: 'MECHANIC', username: 'mecanico')));

    await iniciarSesion(tester, 'mecanico');

    expect(find.text('Vehículos'), findsWidgets);
    expect(find.text('Usuarios'), findsNothing);
  });

  testWidgets('cerrar sesión pide confirmación y vuelve al inicio de sesión', (tester) async {
    await abrirApp(tester, conLogin(loginOk()));
    await iniciarSesion(tester, 'admin');

    await tester.tap(find.byTooltip('Cerrar sesión'));
    await tester.pumpAndSettle();
    expect(find.text('¿Seguro que quieres cerrar sesión?'), findsOneWidget);

    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(find.text('Clientes'), findsWidgets, reason: 'al cancelar se mantiene la sesión');

    await tester.tap(find.byTooltip('Cerrar sesión'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();
    expect(find.text('Usuario o correo electrónico'), findsOneWidget);
  });
}
