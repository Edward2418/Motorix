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
  FakeHandler? otrosHandler,
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
    if (ruta.contains('/reports/') && otrosHandler != null) {
      return otrosHandler(request);
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

Map<String, dynamic> pagina(List<Map<String, dynamic>> filas, {int page = 1, int? total}) =>
    {'data': filas, 'meta': {'page': page, 'pageSize': 50, 'total': total ?? filas.length}};

Map<String, dynamic> margen({List<Map<String, dynamic>>? filas, int? total}) {
  final items = filas ??
      [
        {
          'partId': 1, 'code': 'BUJ', 'name': 'Bujía', 'quantity': 2, 'salePrice': 150.0, 'purchasePrice': 100.0,
          'marginPerUnit': 50.0, 'salesTotal': 300.0, 'costTotal': 200.0, 'marginTotal': 100.0, 'withoutCost': false,
        },
        {
          'partId': 2, 'code': 'FIL', 'name': 'Filtro', 'quantity': 1, 'salePrice': 80.5, 'purchasePrice': null,
          'marginPerUnit': null, 'salesTotal': 80.5, 'costTotal': null, 'marginTotal': null, 'withoutCost': true,
        },
      ];
  return {
    'data': {
      'items': items,
      'totals': items.isEmpty
          ? {'salesTotal': 0, 'costTotal': 0, 'marginTotal': 0, 'withoutCostCount': 0}
          : {'salesTotal': 380.5, 'costTotal': 200.0, 'marginTotal': 100.0, 'withoutCostCount': 1},
    },
    'meta': {'page': 1, 'pageSize': 50, 'total': total ?? items.length},
  };
}

/// Respuesta de cada reporte nuevo, con datos o vacía.
FakeResponse otrosReportes(http.Request request, {bool vacio = false}) {
  final ruta = request.url.path;
  if (ruta.endsWith('/reports/services')) {
    return FakeResponse(200, pagina(vacio ? [] : [{'serviceTypeId': 1, 'name': 'Cambio de aceite', 'count': 7, 'total': 2450.0}]));
  }
  if (ruta.endsWith('/reports/productivity')) {
    return FakeResponse(200, {
      'data': vacio ? <Object>[] : [{'mechanicId': 3, 'mechanicName': 'Ana Ruiz', 'finishedOrders': 4, 'laborTotal': 1800.0}],
    });
  }
  if (ruta.endsWith('/reports/parts-margin')) {
    return FakeResponse(200, margen(filas: vacio ? [] : null));
  }
  return FakeResponse(200, pagina(vacio
      ? []
      : [
          {'partId': 1, 'code': 'BUJ', 'name': 'Bujía', 'unitsOut': 4, 'averageStock': 8.0, 'turnover': 0.5},
          {'partId': 3, 'code': 'BAN', 'name': 'Banda', 'unitsOut': 2, 'averageStock': 0.0, 'turnover': null},
        ]));
}

Future<void> abrirPestana(WidgetTester tester, String nombre) async {
  await tester.tap(find.widgetWithText(Tab, nombre));
  await tester.pumpAndSettle();
}

void main() {
  const pestanas = {
    'Servicios': ('/reports/services', 'Cambio de aceite', 'No hay servicios en órdenes terminadas en este periodo.'),
    'Productividad': ('/reports/productivity', 'Ana Ruiz', 'No hay órdenes terminadas en este periodo.'),
    'Margen de refacciones': ('/reports/parts-margin', 'Bujía', 'No hay refacciones usadas en órdenes terminadas en este periodo.'),
    'Rotación': ('/reports/inventory-turnover', 'Bujía', 'No hay existencias ni salidas en este periodo.'),
  };

  for (final MapEntry(key: nombre, value: (ruta, dato, mensajeVacio)) in pestanas.entries) {
    group('pestaña $nombre', () {
      Future<List<http.Request>> abrir(WidgetTester tester, FakeHandler handler) async {
        final log = await abrirReportes(tester, ingresosHandler: (_) => FakeResponse(200, {'data': ingresos()}), otrosHandler: handler);
        await abrirPestana(tester, nombre);
        return log;
      }

      testWidgets('consulta su reporte con el rango vigente y muestra los datos', (tester) async {
        final hoy = DateTime.now();
        final log = await abrir(tester, otrosReportes);

        final consulta = log.where((r) => r.url.path.endsWith(ruta)).single;
        expect(consulta.url.queryParameters['from'], iso(DateTime(hoy.year, hoy.month, 1)));
        expect(consulta.url.queryParameters['to'], iso(hoy));
        expect(find.text(dato), findsOneWidget);
      });

      testWidgets('al cambiar el periodo vuelve a consultar', (tester) async {
        final hoy = DateTime.now();
        final log = await abrir(tester, otrosReportes);

        await tester.tap(find.text('Hoy'));
        await tester.pumpAndSettle();

        expect(log.where((r) => r.url.path.endsWith(ruta)).last.url.queryParameters['from'], iso(hoy));
      });

      testWidgets('sin datos muestra un mensaje', (tester) async {
        await abrir(tester, (r) => otrosReportes(r, vacio: true));

        expect(find.text(mensajeVacio), findsOneWidget);
      });

      testWidgets('con un error muestra el mensaje y permite reintentar', (tester) async {
        var falla = true;
        await abrir(tester, (r) => falla ? apiError(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado.') : otrosReportes(r));
        expect(find.text('Ocurrió un error inesperado.'), findsOneWidget);

        falla = false;
        await tester.tap(find.text('Reintentar'));
        await tester.pumpAndSettle();
        expect(find.text(dato), findsOneWidget);
      });

      testWidgets('«Exportar» pide el CSV del reporte abierto', (tester) async {
        final log = await abrir(tester, (r) => r.url.queryParameters['format'] == 'csv' ? apiError(500, 'INTERNAL_ERROR', 'Falló.') : otrosReportes(r));

        await tester.tap(find.text('Exportar'));
        await tester.pumpAndSettle();

        final csv = log.where((r) => r.url.queryParameters['format'] == 'csv').single;
        expect(csv.url.path, endsWith(ruta));
      });
    });
  }

  group('detalles de los reportes nuevos', () {
    Future<List<http.Request>> abrir(WidgetTester tester, String nombre, FakeHandler handler) async {
      final log = await abrirReportes(tester, ingresosHandler: (_) => FakeResponse(200, {'data': ingresos()}), otrosHandler: handler);
      await abrirPestana(tester, nombre);
      return log;
    }

    testWidgets('el margen marca «sin costo» y muestra los totales', (tester) async {
      await abrir(tester, 'Margen de refacciones', otrosReportes);

      expect(find.text('Sin costo'), findsOneWidget);
      expect(find.text(r'$380.50'), findsOneWidget);
      expect(find.textContaining('1 refacción sin costo'), findsOneWidget);
      expect(find.textContaining('precio de compra actual'), findsOneWidget);
    });

    testWidgets('la rotación sin existencia promedio dice «Sin existencia»', (tester) async {
      await abrir(tester, 'Rotación', otrosReportes);

      expect(find.text('Sin existencia'), findsOneWidget);
      expect(find.text('0.50'), findsOneWidget);
    });

    testWidgets('en una ventana angosta la tabla del margen muestra una barra de desplazamiento horizontal', (tester) async {
      await abrir(tester, 'Margen de refacciones', otrosReportes);
      tester.view.physicalSize = const Size(950, 2000);
      await tester.pumpAndSettle();

      final barra = tester.widget<Scrollbar>(
        find.ancestor(of: find.byType(DataTable), matching: find.byType(Scrollbar)).first,
      );
      expect(barra.thumbVisibility, isTrue, reason: 'sin una barra visible no se sabe que hay más columnas');
      expect(barra.controller!.position.maxScrollExtent, greaterThan(0), reason: 'la tabla no cabe en 950 px');
    });

    testWidgets('con más de una página permite avanzar', (tester) async {
      final log = await abrir(tester, 'Servicios', (r) {
        final page = int.parse(r.url.queryParameters['page'] ?? '1');
        return FakeResponse(200, pagina([{'serviceTypeId': null, 'name': 'Servicio $page', 'count': 1, 'total': 10.0}], page: page, total: 60));
      });

      await tester.tap(find.byTooltip('Página siguiente'));
      await tester.pumpAndSettle();

      expect(log.last.url.queryParameters['page'], '2');
      expect(find.text('Servicio 2'), findsOneWidget);
    });
  });

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
