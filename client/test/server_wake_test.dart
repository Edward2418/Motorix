import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/main.dart';
import 'package:motorix_client/services/api_client.dart';

import 'helpers/fake_api.dart';

const _aviso = 'El servidor se está iniciando. Puede tardar hasta un minuto.';

Future<void> enviar(WidgetTester tester, Completer<void> espera) async {
  final api = fakeApi(
    (request) => apiError(401, 'UNAUTHENTICATED', 'Credenciales incorrectas.'),
    hold: (request) => request.url.path.endsWith('/auth/login') ? espera.future : null,
  );
  await tester.pumpWidget(MotorixApp(api: api, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.widgetWithText(TextFormField, 'Usuario o correo electrónico'), 'usuario');
  await tester.enterText(find.widgetWithText(TextFormField, 'Contraseña'), 'Clave2026');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pump();
}

void main() {
  test('la aplicación espera lo suficiente a que un servidor dormido despierte', () {
    expect(ApiClient().timeout, greaterThanOrEqualTo(const Duration(seconds: 75)));
  });

  testWidgets('si el inicio de sesión tarda, avisa que el servidor se está iniciando y quita el aviso al terminar', (tester) async {
    final espera = Completer<void>();
    await enviar(tester, espera);
    expect(find.text(_aviso), findsNothing);

    await tester.pump(const Duration(seconds: 6));
    expect(find.text(_aviso), findsOneWidget);

    espera.complete();
    await tester.pumpAndSettle();
    expect(find.text(_aviso), findsNothing);
    expect(find.text('Credenciales incorrectas.'), findsOneWidget);
  });

  testWidgets('una respuesta rápida no muestra el aviso', (tester) async {
    final espera = Completer<void>();
    await enviar(tester, espera);

    espera.complete();
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 6));

    expect(find.text(_aviso), findsNothing);
  });
}
