import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';
import 'package:motorix_client/services/report_saver.dart';

import 'helpers/fake_api.dart';

const _csv = '\uFEFFSección,Concepto,Pagos,Total\r\nPor método de pago,Efectivo,2,750.00\r\nTotal,,2,750.00\r\n';

/// Guardador falso: recuerda lo que le piden guardar y no escribe nada en el disco.
class GuardadorFalso implements ReportSaver {
  final List<({String nombre, List<int> bytes})> guardados = [];
  Object? fallo;

  @override
  Future<String> save({required String fileName, required List<int> bytes}) async {
    if (fallo != null) {
      throw fallo!;
    }
    guardados.add((nombre: fileName, bytes: bytes));
    return 'C:/Users/prueba/Downloads/$fileName';
  }
}

Map<String, dynamic> ingresos() => {
      'from': '2026-11-01',
      'to': '2026-11-20',
      'total': 750.0,
      'paymentsCount': 2,
      'byMethod': [
        {'method': 'EFECTIVO', 'total': 750.0, 'count': 2},
      ],
      'byDay': [
        {'date': '2026-11-05', 'total': 750.0},
      ],
    };

Future<({List<http.Request> log, GuardadorFalso guardador})> abrir(
  WidgetTester tester, {
  FakeResponse Function(http.Request)? alExportar,
  Completer<void>? espera,
}) async {
  tester.view.physicalSize = const Size(2000, 2000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final log = <http.Request>[];
  final guardador = GuardadorFalso();
  final api = fakeApi((request) {
    final ruta = request.url.path;
    if (ruta.endsWith('/auth/login')) {
      return FakeResponse(200, {
        'data': {'token': 't', 'expiresIn': 28800, 'user': userJson(), 'termsAccepted': true},
      });
    }
    if (ruta.endsWith('/notifications/count')) {
      return FakeResponse(200, {'data': {'unread': 0}});
    }
    if (ruta.endsWith('/reports/income')) {
      if (request.url.queryParameters['format'] == 'csv') {
        return (alExportar ?? (_) => FakeResponse(200, _csv))(request);
      }
      return FakeResponse(200, {'data': ingresos()});
    }
    return listaVacia();
  }, log: log, hold: (p) => espera != null && p.url.queryParameters['format'] == 'csv' ? espera.future : null);
  await tester.pumpWidget(MotorixApp(api: api, useGoogleFonts: false, reportSaver: guardador));
  await tester.pumpAndSettle();
  await tester.enterText(find.widgetWithText(TextFormField, 'Usuario o correo electrónico'), 'usuario');
  await tester.enterText(find.widgetWithText(TextFormField, 'Contraseña'), 'Clave2026');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Reportes').first);
  await tester.pumpAndSettle();
  return (log: log, guardador: guardador);
}

void main() {
  testWidgets('«Exportar» pide el CSV del mismo rango que se ve en pantalla', (tester) async {
    final r = await abrir(tester);

    await tester.enterText(find.widgetWithText(TextFormField, 'Desde (AAAA-MM-DD)'), '2026-10-01');
    await tester.enterText(find.widgetWithText(TextFormField, 'Hasta (AAAA-MM-DD)'), '2026-10-31');
    await tester.tap(find.text('Consultar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Exportar'));
    await tester.pumpAndSettle();

    final peticion = r.log.where((p) => p.url.queryParameters['format'] == 'csv').single;
    expect(peticion.url.queryParameters, {'from': '2026-10-01', 'to': '2026-10-31', 'format': 'csv'});
  });

  testWidgets('guarda el archivo con el guardador y muestra su nombre en un mensaje', (tester) async {
    final r = await abrir(tester);

    await tester.tap(find.text('Exportar'));
    await tester.pumpAndSettle();

    expect(r.guardador.guardados, hasLength(1));
    final guardado = r.guardador.guardados.single;
    expect(guardado.nombre, matches(RegExp(r'^ingresos-\d{4}-\d{2}-\d{2}-a-\d{4}-\d{2}-\d{2}\.csv$')));
    // utf8.decode de Dart descarta la marca BOM al decodificar, así que se comprueba aparte en los bytes.
    expect(guardado.bytes.take(3), [0xEF, 0xBB, 0xBF], reason: 'el archivo conserva su marca BOM UTF-8');
    expect(utf8.decode(guardado.bytes), _csv.substring(1), reason: 'el contenido llega intacto');
    expect(find.textContaining(guardado.nombre), findsOneWidget);
    expect(find.textContaining('Reporte guardado'), findsOneWidget);
  });

  testWidgets('un error del servidor muestra un mensaje claro y no guarda nada', (tester) async {
    final r = await abrir(tester, alExportar: (_) => apiError(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado.'));

    await tester.tap(find.text('Exportar'));
    await tester.pumpAndSettle();

    expect(r.guardador.guardados, isEmpty);
    expect(find.textContaining('No se pudo exportar el reporte'), findsOneWidget);
    expect(find.textContaining('Ocurrió un error inesperado.'), findsOneWidget);
  });

  testWidgets('un error al escribir el archivo muestra un mensaje claro', (tester) async {
    final r = await abrir(tester);
    r.guardador.fallo = const ReportSaveException('No hay permiso para escribir en la carpeta de Descargas.');

    await tester.tap(find.text('Exportar'));
    await tester.pumpAndSettle();

    expect(find.textContaining('No se pudo guardar el reporte'), findsOneWidget);
    expect(find.textContaining('No hay permiso para escribir en la carpeta de Descargas.'), findsOneWidget);
  });

  testWidgets('el botón se deshabilita mientras exporta y no se puede exportar dos veces seguidas', (tester) async {
    final espera = Completer<void>();
    final r = await abrir(tester, espera: espera);

    await tester.tap(find.text('Exportar'));
    await tester.pump();
    expect(tester.widget<OutlinedButton>(find.widgetWithText(OutlinedButton, 'Exportar')).onPressed, isNull);
    await tester.tap(find.text('Exportar'), warnIfMissed: false);
    await tester.pump();

    espera.complete();
    await tester.pumpAndSettle();
    expect(r.log.where((p) => p.url.queryParameters['format'] == 'csv'), hasLength(1));
    expect(r.guardador.guardados, hasLength(1));
  });
}
