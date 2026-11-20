import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Map<String, dynamic> configuracion() => {
      'workshop': {'name': 'Taller', 'address': 'Dirección', 'phone': '55 0000 0000', 'source': 'default'},
      'maintenance': {'soonDays': 30, 'soonKm': 1000, 'source': 'default'},
      'updatedAt': null,
      'updatedByName': null,
    };

Map<String, dynamic> aceptacion(String usuario, String nombre, int version, String fecha) => {
      'userId': 1,
      'userName': nombre,
      'username': usuario,
      'version': version,
      'acceptedAt': fecha,
    };

Future<List<http.Request>> abrirConfiguracion(
  WidgetTester tester, {
  required Object? vigente,
  List<Map<String, dynamic>> aceptaciones = const [],
  int? total,
  String role = 'ADMIN',
}) async {
  tester.view.physicalSize = const Size(2000, 1800);
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
      return FakeResponse(200, {'data': vigente});
    }
    if (ruta.endsWith('/terms/acceptances')) {
      return FakeResponse(200, {
        'data': aceptaciones,
        'meta': {'page': 1, 'pageSize': 10, 'total': total ?? aceptaciones.length},
      });
    }
    if (ruta.endsWith('/settings')) {
      return FakeResponse(200, {'data': configuracion()});
    }
    return listaVacia();
  }, log: log);
  await tester.pumpWidget(MotorixApp(api: api, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.widgetWithText(TextFormField, 'Usuario o correo electrónico'), 'usuario');
  await tester.enterText(find.widgetWithText(TextFormField, 'Contraseña'), 'Clave2026');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Configuración').first);
  await tester.pumpAndSettle();
  return log;
}

void main() {
  testWidgets('la sección «Términos» muestra la versión vigente y su fecha de publicación', (tester) async {
    await abrirConfiguracion(
      tester,
      vigente: {'version': 3, 'termsText': 'T', 'privacyText': 'P', 'publishedAt': '2026-11-15T10:00:00.000Z', 'accepted': true},
    );

    expect(find.text('Términos y condiciones'), findsOneWidget);
    expect(find.textContaining('Versión vigente: 3'), findsOneWidget);
    expect(find.textContaining('2026'), findsWidgets);
  });

  testWidgets('lista las aceptaciones con usuario, versión y fecha', (tester) async {
    await abrirConfiguracion(
      tester,
      vigente: {'version': 2, 'termsText': 'T', 'privacyText': 'P', 'publishedAt': '2026-11-15T10:00:00.000Z', 'accepted': true},
      aceptaciones: [
        aceptacion('lucia', 'Lucía Pérez', 2, '2026-11-16T09:00:00.000Z'),
        aceptacion('pedro', 'Pedro Ruiz', 1, '2026-11-02T09:00:00.000Z'),
      ],
    );

    expect(find.text('Usuario'), findsWidgets);
    expect(find.text('Versión'), findsOneWidget);
    expect(find.text('Fecha de aceptación'), findsOneWidget);
    expect(find.text('Lucía Pérez'), findsOneWidget);
    expect(find.text('lucia'), findsOneWidget);
    expect(find.text('Pedro Ruiz'), findsOneWidget);
  });

  testWidgets('sin ninguna versión publicada lo dice con claridad', (tester) async {
    await abrirConfiguracion(tester, vigente: null);

    expect(find.textContaining('Todavía no se ha publicado ninguna versión'), findsOneWidget);
  });

  testWidgets('sin aceptaciones muestra un mensaje de vacío', (tester) async {
    await abrirConfiguracion(
      tester,
      vigente: {'version': 1, 'termsText': 'T', 'privacyText': 'P', 'publishedAt': '2026-11-15T10:00:00.000Z', 'accepted': true},
    );

    expect(find.textContaining('Nadie ha aceptado'), findsOneWidget);
  });

  testWidgets('es solo de lectura: no ofrece editar ni borrar', (tester) async {
    await abrirConfiguracion(
      tester,
      vigente: {'version': 2, 'termsText': 'T', 'privacyText': 'P', 'publishedAt': '2026-11-15T10:00:00.000Z', 'accepted': true},
      aceptaciones: [aceptacion('lucia', 'Lucía Pérez', 2, '2026-11-16T09:00:00.000Z')],
    );

    expect(find.byTooltip('Editar'), findsNothing);
    expect(find.byTooltip('Eliminar'), findsNothing);
    expect(find.text('Publicar versión'), findsNothing);
    expect(find.textContaining('Borrar'), findsNothing);
  });

  testWidgets('con muchas aceptaciones pide la segunda página', (tester) async {
    final log = await abrirConfiguracion(
      tester,
      vigente: {'version': 1, 'termsText': 'T', 'privacyText': 'P', 'publishedAt': '2026-11-15T10:00:00.000Z', 'accepted': true},
      aceptaciones: [aceptacion('lucia', 'Lucía Pérez', 1, '2026-11-16T09:00:00.000Z')],
      total: 25,
    );

    await tester.ensureVisible(find.byTooltip('Página siguiente'));
    await tester.tap(find.byTooltip('Página siguiente'));
    await tester.pumpAndSettle();

    final consultas = log.where((r) => r.url.path.endsWith('/terms/acceptances')).toList();
    expect(consultas.last.url.queryParameters['page'], '2');
  });
}
