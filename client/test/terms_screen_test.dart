import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Map<String, dynamic> terminos({int version = 3, String terminos = 'Texto de los términos.', String aviso = 'Texto del aviso.', bool aceptada = false}) => {
      'version': version,
      'termsText': terminos,
      'privacyText': aviso,
      'publishedAt': '2026-11-15T10:00:00.000Z',
      'accepted': aceptada,
    };

FakeResponse sesion({bool terminosAceptados = false}) => FakeResponse(200, {
      'data': {
        'token': 'token-de-prueba',
        'expiresIn': 28800,
        'user': userJson(),
        'termsAccepted': terminosAceptados,
      },
    });

FakeResponse sinTerminos() => apiError(403, 'TERMS_NOT_ACCEPTED', 'Debes aceptar los términos y condiciones vigentes para continuar.');

/// Servidor falso: el inicio de sesión devuelve `termsAccepted`; `alPedirTerminos` responde GET /terms/current y
/// `alAceptar` responde POST /terms/accept. Todo lo demás responde vacío.
FakeHandler servidor({
  bool terminosAceptados = false,
  FakeResponse Function(http.Request)? alPedirTerminos,
  FakeResponse Function(http.Request)? alAceptar,
  FakeResponse Function(http.Request)? otras,
}) =>
    (request) {
      final ruta = request.url.path;
      if (ruta.endsWith('/auth/login')) {
        return sesion(terminosAceptados: terminosAceptados);
      }
      if (ruta.endsWith('/terms/current')) {
        return (alPedirTerminos ?? (_) => FakeResponse(200, {'data': terminos()}))(request);
      }
      if (ruta.endsWith('/terms/accept')) {
        return (alAceptar ?? (_) => FakeResponse(200, {'data': {'version': 3, 'acceptedAt': '2026-11-20T11:00:00.000Z'}}))(request);
      }
      if (ruta.endsWith('/notifications/count')) {
        return FakeResponse(200, {'data': {'unread': 0}});
      }
      return otras != null ? otras(request) : listaVacia();
    };

Future<List<http.Request>> iniciarSesion(
  WidgetTester tester,
  FakeHandler handler, {
  Future<void>? Function(http.Request request)? hold,
}) async {
  tester.view.physicalSize = const Size(2000, 1400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final log = <http.Request>[];
  await tester.pumpWidget(MotorixApp(api: fakeApi(handler, log: log, hold: hold), useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.widgetWithText(TextFormField, 'Usuario o correo electrónico'), 'usuario');
  await tester.enterText(find.widgetWithText(TextFormField, 'Contraseña'), 'Clave2026');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
  return log;
}

bool enLogin() => find.widgetWithText(TextFormField, 'Usuario o correo electrónico').evaluate().isNotEmpty;

const casillaTerminos = 'He leído y acepto los términos y condiciones';
const casillaAviso = 'He leído el aviso de privacidad';

Future<void> marcarCasillas(WidgetTester tester) async {
  await tester.tap(find.text(casillaTerminos));
  await tester.tap(find.text(casillaAviso));
  await tester.pump();
}

bool aceptarActivo(WidgetTester tester) => tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Aceptar')).onPressed != null;

void main() {
  group('casillas de aceptación', () {
    testWidgets('empiezan sin marcar y «Aceptar» está desactivado', (tester) async {
      await iniciarSesion(tester, servidor());

      final casillas = tester.widgetList<CheckboxListTile>(find.byType(CheckboxListTile));
      expect(casillas.map((c) => c.value), [false, false]);
      expect(aceptarActivo(tester), isFalse);
    });

    testWidgets('con una sola casilla sigue desactivado y con las dos se activa', (tester) async {
      await iniciarSesion(tester, servidor());

      await tester.tap(find.text(casillaTerminos));
      await tester.pump();
      expect(aceptarActivo(tester), isFalse);

      await tester.tap(find.text(casillaAviso));
      await tester.pump();
      expect(aceptarActivo(tester), isTrue);

      await tester.tap(find.text(casillaTerminos));
      await tester.pump();
      expect(aceptarActivo(tester), isFalse);
    });

    testWidgets('si se publica una versión nueva, las casillas vuelven a quedar sin marcar', (tester) async {
      var nueva = false;
      await iniciarSesion(
        tester,
        servidor(
          alPedirTerminos: (_) => FakeResponse(200, {'data': terminos(version: nueva ? 4 : 3)}),
          alAceptar: (_) {
            nueva = true;
            return apiError(409, 'TERMS_VERSION_OUTDATED', 'Se publicó una versión más nueva.');
          },
        ),
      );
      await marcarCasillas(tester);

      await tester.tap(find.text('Aceptar'));
      await tester.pumpAndSettle();

      expect(find.text('Versión 4'), findsOneWidget);
      expect(tester.widgetList<CheckboxListTile>(find.byType(CheckboxListTile)).map((c) => c.value), [false, false]);
      expect(aceptarActivo(tester), isFalse);
    });
  });

  group('pantalla de términos tras iniciar sesión', () {
    testWidgets('con términos pendientes muestra los términos y el aviso de privacidad antes de cualquier módulo', (tester) async {
      await iniciarSesion(tester, servidor());

      expect(find.text('Términos y condiciones'), findsOneWidget);
      expect(find.text('Texto de los términos.'), findsOneWidget);
      expect(find.text('Aviso de privacidad'), findsOneWidget);
      expect(find.text('Texto del aviso.'), findsOneWidget);
      expect(find.text('Aceptar'), findsOneWidget);
      expect(find.text('Rechazar'), findsOneWidget);
      expect(find.text('Clientes'), findsNothing, reason: 'no debe verse ningún módulo antes de aceptar');
      expect(find.text('Panel'), findsNothing);
    });

    testWidgets('con los términos ya aceptados entra directo a la aplicación', (tester) async {
      await iniciarSesion(tester, servidor(terminosAceptados: true));

      expect(find.text('Términos y condiciones'), findsNothing);
      expect(find.text('Clientes'), findsWidgets);
    });

    testWidgets('aceptar envía la versión mostrada y entra a la aplicación', (tester) async {
      final log = await iniciarSesion(tester, servidor());

      await marcarCasillas(tester);

      await tester.tap(find.text('Aceptar'));
      await tester.pumpAndSettle();

      final envios = log.where((r) => r.method == 'POST' && r.url.path.endsWith('/terms/accept')).toList();
      expect(envios, hasLength(1));
      expect(envios.single.body, contains('"version":3'));
      expect(find.text('Términos y condiciones'), findsNothing);
      expect(find.text('Clientes'), findsWidgets);
    });

    testWidgets('rechazar cierra la sesión sin enviar nada', (tester) async {
      final log = await iniciarSesion(tester, servidor());

      await tester.tap(find.text('Rechazar'));
      await tester.pumpAndSettle();

      expect(enLogin(), isTrue);
      expect(log.where((r) => r.url.path.endsWith('/terms/accept')), isEmpty);
    });

    testWidgets('si se publicó una versión más nueva, aceptar avisa y muestra la nueva', (tester) async {
      var nueva = false;
      await iniciarSesion(
        tester,
        servidor(
          alPedirTerminos: (_) => FakeResponse(200, {'data': nueva ? terminos(version: 4, terminos: 'Términos nuevos.') : terminos()}),
          alAceptar: (_) {
            nueva = true;
            return apiError(409, 'TERMS_VERSION_OUTDATED', 'Esa versión de los términos ya no es la vigente. Vuelve a abrirlos para leer la nueva.');
          },
        ),
      );

      await marcarCasillas(tester);

      await tester.tap(find.text('Aceptar'));
      await tester.pumpAndSettle();

      expect(find.textContaining('ya no es la vigente'), findsOneWidget);
      expect(find.text('Términos nuevos.'), findsOneWidget);
      expect(find.text('Clientes'), findsNothing);
    });
  });

  group('403 TERMS_NOT_ACCEPTED durante el uso', () {
    testWidgets('lleva a la pantalla de términos aunque el inicio de sesión dijera que estaban aceptados', (tester) async {
      await iniciarSesion(
        tester,
        servidor(terminosAceptados: true, otras: (_) => sinTerminos()),
      );

      expect(find.text('Términos y condiciones'), findsOneWidget);
      expect(find.text('Aceptar'), findsOneWidget);
    });
  });

  group('estados', () {
    testWidgets('muestra el estado de carga mientras llegan los términos', (tester) async {
      final espera = Completer<void>();
      tester.view.physicalSize = const Size(2000, 1400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        MotorixApp(
          api: fakeApi(servidor(), hold: (r) => r.url.path.endsWith('/terms/current') ? espera.future : null),
          useGoogleFonts: false,
        ),
      );
      await tester.pumpAndSettle();
      await tester.enterText(find.widgetWithText(TextFormField, 'Usuario o correo electrónico'), 'usuario');
      await tester.enterText(find.widgetWithText(TextFormField, 'Contraseña'), 'Clave2026');
      await tester.tap(find.text('Iniciar sesión'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      await tester.pump(const Duration(milliseconds: 50));

      expect(find.byType(CircularProgressIndicator), findsWidgets);
      expect(find.text('Aceptar'), findsNothing);

      espera.complete();
      await tester.pumpAndSettle();
      expect(find.text('Aceptar'), findsOneWidget);
    });

    testWidgets('con un error del servidor muestra el mensaje, permite reintentar y no deja aceptar', (tester) async {
      var falla = true;
      await iniciarSesion(
        tester,
        servidor(alPedirTerminos: (_) => falla ? apiError(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado.') : FakeResponse(200, {'data': terminos()})),
      );

      expect(find.text('Ocurrió un error inesperado.'), findsOneWidget);
      expect(find.text('Aceptar'), findsNothing);
      expect(find.text('Rechazar'), findsOneWidget, reason: 'siempre se puede salir');

      falla = false;
      await tester.tap(find.text('Reintentar'));
      await tester.pumpAndSettle();
      expect(find.text('Aceptar'), findsOneWidget);
    });

    testWidgets('si en realidad no hay versión publicada, entra a la aplicación', (tester) async {
      await iniciarSesion(tester, servidor(alPedirTerminos: (_) => FakeResponse(200, {'data': null})));
      expect(find.text('Términos y condiciones'), findsNothing);
      expect(find.text('Clientes'), findsWidgets);
    });

    testWidgets('una pantalla de términos desatendida cierra la sesión a los 30 minutos', (tester) async {
      await iniciarSesion(tester, servidor());
      expect(find.text('Aceptar'), findsOneWidget);

      await tester.pump(const Duration(minutes: 30, seconds: 1));
      await tester.pumpAndSettle();

      expect(enLogin(), isTrue);
      expect(find.text('Tu sesión se cerró por inactividad. Inicia sesión de nuevo.'), findsOneWidget);
    });
  });
}
