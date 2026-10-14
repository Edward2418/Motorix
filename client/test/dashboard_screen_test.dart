import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';
import 'package:motorix_client/providers/dashboard_provider.dart';
import 'package:motorix_client/providers/navigation_provider.dart';
import 'package:motorix_client/screens/dashboard_screen.dart';
import 'package:motorix_client/utils/app_theme.dart';
import 'package:provider/provider.dart';

import 'helpers/fake_api.dart';

const estados = ['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION', 'TERMINADO', 'ENTREGADO', 'CANCELADA'];

Map<String, dynamic> ordenRef(int id, {double total = 1000, double saldo = 1000, String estado = 'TERMINADO'}) => {
      'id': id,
      'folio': 'OS-2026-000$id',
      'clientName': 'Cliente $id',
      'vehicleLabel': 'ABC123$id · Nissan Versa 2020',
      'status': estado,
      'total': total,
      'balance': saldo,
      'finishedAt': '2026-10-13T10:00:00.000Z',
    };

Map<String, dynamic> panelJson({
  String periodo = 'month',
  List<int>? cuentas,
  double cobrado = 2500.5,
  int stockBajo = 2,
  Map<String, dynamic>? atencion,
}) {
  final conteos = cuentas ?? [1, 2, 3, 4, 5, 6, 7];
  return {
    'period': {'key': periodo, 'from': '2026-10-01T06:00:00.000Z', 'to': '2026-10-14T05:59:59.999Z'},
    'indicators': {'vehiclesInRepair': conteos[2], 'openOrders': 15, 'collected': cobrado, 'lowStockParts': stockBajo},
    'ordersByStatus': [
      for (var i = 0; i < estados.length; i++) {'status': estados[i], 'count': conteos[i]},
    ],
    'attention': atencion ?? panelAtencionVacio(),
  };
}

Map<String, dynamic> panelAtencionVacio() => {
      'finishedOrders': {'count': 0, 'items': <Object>[]},
      'upcomingAppointments': {'count': 0, 'items': <Object>[]},
      'maintenance': {'overdue': 0, 'soon': 0, 'items': <Object>[]},
      'lowStockParts': {'count': 0, 'items': <Object>[]},
      'pendingBalance': {'total': 0, 'count': 0, 'items': <Object>[]},
    };

/// Pantalla del panel sola, con proveedores reales y un servidor simulado.
Future<({NavigationProvider navegacion, List<http.Request> log})> abrirPanel(
  WidgetTester tester, {
  required FakeHandler handler,
}) async {
  tester.view.physicalSize = const Size(1500, 2200);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final log = <http.Request>[];
  final api = fakeApi(handler, log: log);
  final navegacion = NavigationProvider();
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => DashboardProvider(api)),
        ChangeNotifierProvider<NavigationProvider>.value(value: navegacion),
      ],
      child: MaterialApp(theme: buildAppTheme(useGoogleFonts: false), home: const Scaffold(body: DashboardScreen())),
    ),
  );
  await tester.pumpAndSettle();
  return (navegacion: navegacion, log: log);
}

void main() {
  testWidgets('muestra los cuatro indicadores y la gráfica de órdenes por estado', (tester) async {
    await abrirPanel(tester, handler: (_) => FakeResponse(200, {'data': panelJson()}));
    expect(find.text('Vehículos en reparación'), findsOneWidget);
    expect(find.text('Órdenes pendientes'), findsOneWidget);
    expect(find.text('Importe cobrado'), findsOneWidget);
    expect(find.text('Refacciones con stock bajo'), findsOneWidget);
    expect(find.text(r'$2,500.50'), findsOneWidget);
    expect(find.text('15'), findsOneWidget);
    expect(find.text('Órdenes por estado'), findsOneWidget);
    for (final etiqueta in ['Recibido', 'Diagnóstico', 'En reparación', 'Esperando refacción', 'Terminado', 'Entregado', 'Cancelada']) {
      expect(find.text(etiqueta), findsWidgets, reason: etiqueta);
    }
  });

  testWidgets('cambiar el periodo vuelve a consultar con ese periodo', (tester) async {
    final servidor = await abrirPanel(
      tester,
      handler: (request) => FakeResponse(200, {'data': panelJson(periodo: request.url.queryParameters['period'] ?? 'month')}),
    );
    expect(servidor.log.last.url.queryParameters['period'], 'month');
    await tester.tap(find.text('Hoy'));
    await tester.pumpAndSettle();
    expect(servidor.log.last.url.queryParameters['period'], 'today');
    await tester.tap(find.text('Últimos 7 días'));
    await tester.pumpAndSettle();
    expect(servidor.log.last.url.queryParameters['period'], 'week');
    expect(servidor.log.where((r) => r.url.path.endsWith('/dashboard')), hasLength(3));
  });

  testWidgets('con todo en ceros no genera errores y avisa que no hay órdenes', (tester) async {
    await abrirPanel(
      tester,
      handler: (_) => FakeResponse(200, {'data': panelJson(cuentas: [0, 0, 0, 0, 0, 0, 0], cobrado: 0, stockBajo: 0)}),
    );
    expect(tester.takeException(), isNull);
    expect(find.text(r'$0.00'), findsOneWidget);
    expect(find.text('Todavía no hay órdenes registradas.'), findsOneWidget);
    expect(find.text('No hay órdenes terminadas en este periodo.'), findsOneWidget);
  });

  testWidgets('un error del servidor se muestra y permite reintentar', (tester) async {
    var intentos = 0;
    await abrirPanel(
      tester,
      handler: (_) {
        intentos++;
        return intentos == 1 ? apiError(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado.') : FakeResponse(200, {'data': panelJson()});
      },
    );
    expect(find.text('Ocurrió un error inesperado.'), findsOneWidget);
    await tester.tap(find.text('Reintentar'));
    await tester.pumpAndSettle();
    expect(find.text('Importe cobrado'), findsOneWidget);
    expect(intentos, 2);
  });

  testWidgets('el indicador de órdenes abre el módulo de órdenes de servicio', (tester) async {
    final servidor = await abrirPanel(tester, handler: (_) => FakeResponse(200, {'data': panelJson()}));
    await tester.tap(find.text('Órdenes pendientes'));
    await tester.pumpAndSettle();
    expect(servidor.navegacion.selectedLabel, 'Órdenes de servicio');
  });

  Future<void> iniciarSesion(WidgetTester tester, String rol) async {
    tester.view.physicalSize = const Size(1500, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final api = fakeApi((request) {
      if (request.url.path.endsWith('/auth/login')) {
        return loginOk(role: rol);
      }
      if (request.url.path.endsWith('/dashboard')) {
        return FakeResponse(200, {'data': panelJson()});
      }
      return listaVacia();
    });
    await tester.pumpWidget(MotorixApp(api: api, useGoogleFonts: false));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Usuario o correo electrónico'), 'usuario');
    await tester.enterText(find.widgetWithText(TextFormField, 'Contraseña'), 'Clave2026');
    await tester.tap(find.text('Iniciar sesión'));
    await tester.pumpAndSettle();
  }

  testWidgets('el administrador ve «Panel» como primera sección del menú y empieza en él', (tester) async {
    await iniciarSesion(tester, 'ADMIN');
    expect(find.text('Panel'), findsWidgets);
    expect(find.text('Resumen del taller'), findsOneWidget);
  });

  for (final rol in ['RECEPTIONIST', 'MECHANIC']) {
    testWidgets('el rol $rol no tiene «Panel» en el menú', (tester) async {
      await iniciarSesion(tester, rol);
      expect(find.text('Panel'), findsNothing);
      expect(find.text('Resumen del taller'), findsNothing);
    });
  }
}
