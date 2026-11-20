import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

const _inactividad = Duration(minutes: 30);

FakeHandler _servidor() => (request) {
      if (request.url.path.endsWith('/auth/login')) {
        return loginOk();
      }
      if (request.url.path.endsWith('/notifications/count')) {
        return FakeResponse(200, {
          'data': {'unread': 0},
        });
      }
      return listaVacia();
    };

Future<void> _iniciarSesion(WidgetTester tester) async {
  tester.view.physicalSize = const Size(2000, 1400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(MotorixApp(api: fakeApi(_servidor()), useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.widgetWithText(TextFormField, 'Usuario o correo electrónico'), 'usuario');
  await tester.enterText(find.widgetWithText(TextFormField, 'Contraseña'), 'Clave2026');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
}

bool _enLogin() => find.widgetWithText(TextFormField, 'Usuario o correo electrónico').evaluate().isNotEmpty;

void main() {
  group('cierre de sesión por inactividad', () {
    testWidgets('antes de 30 minutos sin actividad la sesión sigue abierta', (tester) async {
      await _iniciarSesion(tester);

      await tester.pump(_inactividad - const Duration(minutes: 1));

      expect(_enLogin(), isFalse, reason: 'a los 29 minutos la sesión debe seguir abierta');
    });

    testWidgets('tras 30 minutos sin actividad cierra la sesión y la pantalla de inicio muestra el motivo', (tester) async {
      await _iniciarSesion(tester);

      await tester.pump(_inactividad + const Duration(seconds: 1));
      await tester.pumpAndSettle();

      expect(_enLogin(), isTrue, reason: 'debe volver a la pantalla de inicio de sesión');
      expect(find.text('Tu sesión se cerró por inactividad. Inicia sesión de nuevo.'), findsOneWidget);
    });

    testWidgets('la actividad del puntero reinicia el temporizador', (tester) async {
      await _iniciarSesion(tester);

      await tester.pump(const Duration(minutes: 29));
      final gesto = await tester.createGesture(kind: PointerDeviceKind.mouse);
      await gesto.addPointer(location: const Offset(400, 300));
      await gesto.moveTo(const Offset(420, 320));
      await tester.pump(const Duration(minutes: 29));

      expect(_enLogin(), isFalse, reason: 'el movimiento reinició la cuenta: a los 58 minutos totales sigue abierta');

      await tester.pump(const Duration(minutes: 2));
      await tester.pumpAndSettle();
      expect(_enLogin(), isTrue, reason: 'pasados 30 minutos desde el último movimiento se cierra');
    });

    testWidgets('la actividad del teclado reinicia el temporizador', (tester) async {
      await _iniciarSesion(tester);

      await tester.pump(const Duration(minutes: 29));
      await tester.sendKeyEvent(LogicalKeyboardKey.shiftLeft);
      await tester.pump(const Duration(minutes: 29));

      expect(_enLogin(), isFalse, reason: 'la tecla reinició la cuenta');

      await tester.pump(const Duration(minutes: 2));
      await tester.pumpAndSettle();
      expect(_enLogin(), isTrue);
    });

    testWidgets('sin sesión no hace nada: la pantalla de inicio se queda sin mensaje de inactividad', (tester) async {
      tester.view.physicalSize = const Size(2000, 1400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(MotorixApp(api: fakeApi(_servidor()), useGoogleFonts: false));
      await tester.pumpAndSettle();

      await tester.pump(_inactividad * 2);
      await tester.pumpAndSettle();

      expect(_enLogin(), isTrue);
      expect(find.textContaining('inactividad'), findsNothing);
    });

    testWidgets('al iniciar sesión de nuevo el mensaje de inactividad desaparece y el temporizador vuelve a correr', (tester) async {
      await _iniciarSesion(tester);
      await tester.pump(_inactividad + const Duration(seconds: 1));
      await tester.pumpAndSettle();
      expect(find.textContaining('inactividad'), findsOneWidget);

      await tester.enterText(find.widgetWithText(TextFormField, 'Usuario o correo electrónico'), 'usuario');
      await tester.enterText(find.widgetWithText(TextFormField, 'Contraseña'), 'Clave2026');
      await tester.tap(find.text('Iniciar sesión'));
      await tester.pumpAndSettle();

      expect(_enLogin(), isFalse);
      await tester.pump(_inactividad - const Duration(minutes: 1));
      expect(_enLogin(), isFalse);
      await tester.pump(const Duration(minutes: 2));
      await tester.pumpAndSettle();
      expect(_enLogin(), isTrue);
    });
  });
}
