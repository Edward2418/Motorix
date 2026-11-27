import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

const _terminos = 'Usa el sistema solo para administrar el taller.';
const _aviso = 'Guardamos los datos de clientes y vehículos del taller.';

Map<String, dynamic> vigente() => {
      'version': 2,
      'termsText': _terminos,
      'privacyText': _aviso,
      'publishedAt': '2026-11-15T10:00:00.000Z',
      'accepted': true,
    };

Future<List<http.Request>> entrar(
  WidgetTester tester, {
  String role = 'ADMIN',
  FakeResponse Function()? terminos,
  Size ventana = const Size(2000, 1800),
}) async {
  tester.view.physicalSize = ventana;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final log = <http.Request>[];
  final api = fakeApi((request) {
    final ruta = request.url.path;
    if (ruta.endsWith('/auth/login')) {
      return FakeResponse(200, {
        'data': {'token': 't', 'expiresIn': 28800, 'user': userJson(role: role), 'termsAccepted': true},
      });
    }
    if (ruta.endsWith('/notifications/count')) {
      return FakeResponse(200, {'data': {'unread': 0}});
    }
    if (ruta.endsWith('/terms/current')) {
      return terminos?.call() ?? FakeResponse(200, {'data': vigente()});
    }
    if (ruta.endsWith('/settings')) {
      return FakeResponse(200, {
        'data': {
          'workshop': {'name': 'Taller', 'address': 'Dirección', 'phone': '55 0000 0000', 'source': 'default'},
          'maintenance': {'soonDays': 30, 'soonKm': 1000, 'source': 'default'},
          'updatedAt': null,
          'updatedByName': null,
        },
      });
    }
    return listaVacia();
  }, log: log);
  await tester.pumpWidget(MotorixApp(api: api, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.widgetWithText(TextFormField, 'Usuario o correo electrónico'), 'usuario');
  await tester.enterText(find.widgetWithText(TextFormField, 'Contraseña'), 'Clave2026');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
  return log;
}

Future<void> abrirDesdeElMenu(WidgetTester tester) async {
  await tester.tap(find.byTooltip('Menú del perfil'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Términos y aviso de privacidad'));
  await tester.pumpAndSettle();
}

void main() {
  for (final rol in ['ADMIN', 'RECEPTIONIST', 'MECHANIC']) {
    testWidgets('el rol $rol lee los términos y el aviso de privacidad desde el menú de su cuenta', (tester) async {
      await entrar(tester, role: rol);

      await abrirDesdeElMenu(tester);

      expect(find.text(_terminos), findsOneWidget);
      expect(find.text('Aviso de privacidad'), findsOneWidget);
      expect(find.text(_aviso), findsOneWidget);
      expect(find.textContaining('Versión 2'), findsOneWidget);
    });
  }

  testWidgets('la vista es de solo lectura y «Cerrar» regresa sin cerrar la sesión ni aceptar de nuevo', (tester) async {
    final log = await entrar(tester);
    await abrirDesdeElMenu(tester);
    expect(find.text('Aceptar'), findsNothing);
    expect(find.text('Rechazar'), findsNothing);

    await tester.tap(find.text('Cerrar'));
    await tester.pumpAndSettle();

    expect(find.text(_aviso), findsNothing);
    expect(find.byTooltip('Menú del perfil'), findsOneWidget);
    expect(log.where((r) => r.url.path.endsWith('/terms/accept')), isEmpty);
  });

  testWidgets('en Configuración, «Ver texto» abre la misma vista', (tester) async {
    await entrar(tester);
    await tester.tap(find.text('Configuración').first);
    await tester.pumpAndSettle();

    await tester.tap(find.text('Ver texto'));
    await tester.pumpAndSettle();

    expect(find.text(_terminos), findsOneWidget);
    expect(find.text(_aviso), findsOneWidget);
  });

  testWidgets('desde el inicio de sesión se puede leer sin entrar, con la consulta pública', (tester) async {
    final log = <http.Request>[];
    final api = fakeApi(
      // La misma forma que responde el servidor: la consulta pública no trae `accepted`.
      (request) => request.url.path.endsWith('/terms/public')
          ? FakeResponse(200, {'data': vigente()..remove('accepted')})
          : apiError(401, 'UNAUTHENTICATED', 'Sin sesión.'),
      log: log,
    );
    await tester.pumpWidget(MotorixApp(api: api, useGoogleFonts: false));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Términos y aviso de privacidad'));
    await tester.pumpAndSettle();

    expect(find.text(_terminos), findsOneWidget);
    expect(find.text(_aviso), findsOneWidget);
    expect(log.map((r) => r.url.path), everyElement(endsWith('/terms/public')));
    await tester.tap(find.text('Cerrar'));
    await tester.pumpAndSettle();
    expect(find.text('Iniciar sesión'), findsOneWidget);
  });

  testWidgets('los títulos de sección del texto se destacan', (tester) async {
    await entrar(
      tester,
      terminos: () => FakeResponse(200, {'data': {...vigente(), 'termsText': '1. Objeto\nPara administrar el taller.'}}),
    );
    await abrirDesdeElMenu(tester);

    final titulo = tester.widget<Text>(find.text('1. Objeto'));
    final cuerpo = tester.widget<Text>(find.text('Para administrar el taller.'));
    expect(titulo.style!.fontWeight, isNot(cuerpo.style!.fontWeight));
  });

  testWidgets('sin ninguna versión publicada lo dice con claridad', (tester) async {
    await entrar(tester, terminos: () => FakeResponse(200, {'data': null}));

    await abrirDesdeElMenu(tester);

    expect(find.text('Todavía no se ha publicado ninguna versión.'), findsOneWidget);
  });

  testWidgets('con un error muestra el mensaje y permite reintentar', (tester) async {
    var falla = true;
    await entrar(
      tester,
      terminos: () => falla ? apiError(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado.') : FakeResponse(200, {'data': vigente()}),
    );
    await abrirDesdeElMenu(tester);
    expect(find.text('Ocurrió un error inesperado.'), findsOneWidget);

    falla = false;
    // El panel de fondo puede tener su propio «Reintentar»: se pulsa el de la vista.
    await tester.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Reintentar')));
    await tester.pumpAndSettle();

    expect(find.text(_aviso), findsOneWidget);
  });

  testWidgets('un texto largo en una ventana baja se puede desplazar hasta el final', (tester) async {
    final largo = List.filled(120, 'Cláusula de ejemplo.').join('\n');
    await entrar(
      tester,
      role: 'MECHANIC',
      ventana: const Size(1200, 700),
      terminos: () => FakeResponse(200, {'data': {...vigente(), 'termsText': largo}}),
    );
    await abrirDesdeElMenu(tester);

    await tester.ensureVisible(find.text(_aviso));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text(_aviso).hitTestable(), findsOneWidget);
    expect(find.text('Cerrar').hitTestable(), findsOneWidget);
  });
}
