import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';
import 'package:motorix_client/models/payment.dart';

import 'helpers/fake_api.dart';

String iso(DateTime fecha) => '${fecha.year}-${fecha.month.toString().padLeft(2, '0')}-${fecha.day.toString().padLeft(2, '0')}';

Map<String, dynamic> ingresos({
  String from = '2026-11-01',
  String to = '2026-11-20',
  double total = 800.5,
  int pagos = 3,
  List<Map<String, dynamic>>? porMetodo,
  List<Map<String, dynamic>>? porDia,
}) =>
    {
      'from': from,
      'to': to,
      'total': total,
      'paymentsCount': pagos,
      'byMethod': porMetodo ??
          [
            {'method': 'EFECTIVO', 'total': 500.5, 'count': 2},
            {'method': 'TARJETA', 'total': 300.0, 'count': 1},
          ],
      'byDay': porDia ??
          [
            {'date': '2026-11-05', 'total': 500.5},
            {'date': '2026-11-06', 'total': 300.0},
          ],
    };

FakeResponse sinPagos() => FakeResponse(200, {'data': ingresos(total: 0, pagos: 0, porMetodo: [], porDia: [])});

Future<List<http.Request>> abrirReportes(
  WidgetTester tester, {
  String role = 'ADMIN',
  required FakeResponse Function(http.Request) ingresosHandler,
  bool abrirPantalla = true,
  Future<void>? Function(http.Request request)? hold,
  bool esperar = true,
}) async {
  tester.view.physicalSize = const Size(2000, 2000);
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
    if (ruta.endsWith('/reports/income')) {
      return ingresosHandler(request);
    }
    return listaVacia();
  }, log: log, hold: hold);
  await tester.pumpWidget(MotorixApp(api: api, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.widgetWithText(TextFormField, 'Usuario o correo electrónico'), 'usuario');
  await tester.enterText(find.widgetWithText(TextFormField, 'Contraseña'), 'Clave2026');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
  if (abrirPantalla) {
    await tester.tap(find.text('Reportes').first);
    if (esperar) {
      await tester.pumpAndSettle();
    } else {
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
    }
  }
  return log;
}

List<http.Request> consultas(List<http.Request> log) => log.where((r) => r.url.path.endsWith('/reports/income')).toList();

Map<String, String> ultima(List<http.Request> log) => consultas(log).last.url.queryParameters;

void main() {
  group('ingresos', () {
    testWidgets('al abrir consulta el mes en curso (del día 1 a hoy) y muestra el total, la cantidad y el desglose', (tester) async {
      final hoy = DateTime.now();
      final log = await abrirReportes(tester, ingresosHandler: (_) => FakeResponse(200, {'data': ingresos()}));

      expect(consultas(log), hasLength(1));
      expect(ultima(log), {'from': iso(DateTime(hoy.year, hoy.month, 1)), 'to': iso(hoy)});
      expect(find.text('Ingresos'), findsWidgets);
      expect(find.text(r'$800.50'), findsWidgets);
      expect(find.textContaining('3 pagos'), findsOneWidget);
      expect(find.text(PaymentMethod.cash.label), findsOneWidget);
      expect(find.text(PaymentMethod.card.label), findsOneWidget);
      expect(find.text(r'$500.50'), findsWidgets);
      expect(find.text(r'$300.00'), findsWidgets);
    });

    testWidgets('muestra el desglose por día', (tester) async {
      await abrirReportes(tester, ingresosHandler: (_) => FakeResponse(200, {'data': ingresos()}));

      expect(find.text('Por día'), findsOneWidget);
      expect(find.text('5 nov 2026'), findsOneWidget);
      expect(find.text('6 nov 2026'), findsOneWidget);
    });

    testWidgets('los atajos Hoy, Semana y Mes consultan el rango que les corresponde', (tester) async {
      final hoy = DateTime.now();
      final log = await abrirReportes(tester, ingresosHandler: (_) => FakeResponse(200, {'data': ingresos()}));

      await tester.tap(find.text('Hoy'));
      await tester.pumpAndSettle();
      expect(ultima(log), {'from': iso(hoy), 'to': iso(hoy)});

      await tester.tap(find.text('Semana'));
      await tester.pumpAndSettle();
      expect(ultima(log), {'from': iso(DateTime(hoy.year, hoy.month, hoy.day - 6)), 'to': iso(hoy)});

      await tester.tap(find.text('Mes'));
      await tester.pumpAndSettle();
      expect(ultima(log), {'from': iso(DateTime(hoy.year, hoy.month, 1)), 'to': iso(hoy)});
    });

    testWidgets('un rango libre consulta las fechas escritas', (tester) async {
      final log = await abrirReportes(tester, ingresosHandler: (_) => FakeResponse(200, {'data': ingresos()}));

      await tester.enterText(find.widgetWithText(TextFormField, 'Desde (AAAA-MM-DD)'), '2026-10-01');
      await tester.enterText(find.widgetWithText(TextFormField, 'Hasta (AAAA-MM-DD)'), '2026-10-31');
      await tester.tap(find.text('Consultar'));
      await tester.pumpAndSettle();

      expect(ultima(log), {'from': '2026-10-01', 'to': '2026-10-31'});
    });

    testWidgets('sin pagos en el periodo muestra un mensaje en lugar de tablas vacías', (tester) async {
      await abrirReportes(tester, ingresosHandler: (_) => sinPagos());

      expect(find.textContaining('No hay pagos cobrados'), findsOneWidget);
      expect(find.text('Por día'), findsNothing);
    });

    testWidgets('un rango con fechas mal escritas muestra el error y no consulta', (tester) async {
      final log = await abrirReportes(tester, ingresosHandler: (_) => FakeResponse(200, {'data': ingresos()}));
      final antes = consultas(log).length;

      await tester.enterText(find.widgetWithText(TextFormField, 'Desde (AAAA-MM-DD)'), '01/10/2026');
      await tester.enterText(find.widgetWithText(TextFormField, 'Hasta (AAAA-MM-DD)'), '2026-10-31');
      await tester.tap(find.text('Consultar'));
      await tester.pumpAndSettle();

      expect(find.text('Escribe la fecha como AAAA-MM-DD, por ejemplo 2026-11-01.'), findsOneWidget);
      expect(consultas(log).length, antes);
    });

    testWidgets('una fecha inicial posterior a la final muestra el error y no consulta', (tester) async {
      final log = await abrirReportes(tester, ingresosHandler: (_) => FakeResponse(200, {'data': ingresos()}));
      final antes = consultas(log).length;

      await tester.enterText(find.widgetWithText(TextFormField, 'Desde (AAAA-MM-DD)'), '2026-10-31');
      await tester.enterText(find.widgetWithText(TextFormField, 'Hasta (AAAA-MM-DD)'), '2026-10-01');
      await tester.tap(find.text('Consultar'));
      await tester.pumpAndSettle();

      expect(find.text('La fecha inicial no puede ser posterior a la final.'), findsOneWidget);
      expect(consultas(log).length, antes);
    });

    testWidgets('un rango de más de 366 días muestra el error y no consulta', (tester) async {
      final log = await abrirReportes(tester, ingresosHandler: (_) => FakeResponse(200, {'data': ingresos()}));
      final antes = consultas(log).length;

      await tester.enterText(find.widgetWithText(TextFormField, 'Desde (AAAA-MM-DD)'), '2026-01-01');
      await tester.enterText(find.widgetWithText(TextFormField, 'Hasta (AAAA-MM-DD)'), '2027-01-02');
      await tester.tap(find.text('Consultar'));
      await tester.pumpAndSettle();

      expect(find.text('El rango no puede pasar de 366 días.'), findsOneWidget);
      expect(consultas(log).length, antes);
    });

    testWidgets('si el servidor rechaza el rango muestra su mensaje', (tester) async {
      await abrirReportes(
        tester,
        ingresosHandler: (_) => apiError(400, 'REPORT_RANGE_INVALID', 'El rango de fechas del reporte no es válido.'),
      );

      expect(find.text('El rango de fechas del reporte no es válido.'), findsOneWidget);
    });
  });

  group('estados', () {
    testWidgets('muestra el estado de carga mientras llega el reporte', (tester) async {
      final espera = Completer<void>();
      await abrirReportes(
        tester,
        ingresosHandler: (_) => FakeResponse(200, {'data': ingresos()}),
        hold: (r) => r.url.path.endsWith('/reports/income') ? espera.future : null,
        esperar: false,
      );

      expect(find.byType(CircularProgressIndicator), findsWidgets);
      expect(find.text(r'$800.50'), findsNothing);

      espera.complete();
      await tester.pumpAndSettle();
      expect(find.text(r'$800.50'), findsWidgets);
    });

    testWidgets('con un error del servidor muestra el mensaje y permite reintentar', (tester) async {
      var falla = true;
      await abrirReportes(
        tester,
        ingresosHandler: (_) => falla ? apiError(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado.') : FakeResponse(200, {'data': ingresos()}),
      );
      expect(find.text('Ocurrió un error inesperado.'), findsOneWidget);

      falla = false;
      await tester.tap(find.text('Reintentar'));
      await tester.pumpAndSettle();
      expect(find.text(r'$800.50'), findsWidgets);
    });
  });

  group('destino del menú', () {
    testWidgets('el administrador ve «Reportes»', (tester) async {
      await abrirReportes(tester, ingresosHandler: (_) => sinPagos(), abrirPantalla: false);
      expect(find.text('Reportes'), findsWidgets);
    });

    testWidgets('recepción y mecánico no ven «Reportes»', (tester) async {
      for (final rol in ['RECEPTIONIST', 'MECHANIC']) {
        await abrirReportes(tester, role: rol, ingresosHandler: (_) => sinPagos(), abrirPantalla: false);
        expect(find.text('Reportes'), findsNothing, reason: 'el rol $rol no debe ver los reportes');
        await tester.pumpWidget(const SizedBox());
      }
    });
  });
}
