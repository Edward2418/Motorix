import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/providers/auth_provider.dart';
import 'package:motorix_client/providers/orders_provider.dart';
import 'package:motorix_client/screens/order_detail_screen.dart';
import 'package:motorix_client/utils/app_theme.dart';
import 'package:provider/provider.dart';

import 'helpers/fake_api.dart';

/// Orden de prueba asignada al mecánico con id 1 (el que devuelve `loginOk`).
Map<String, dynamic> orden({
  String estado = 'EN_REPARACION',
  int mecanicoId = 1,
  List<Map<String, dynamic>> servicios = const [],
  List<Map<String, dynamic>> manoDeObra = const [],
}) {
  final serviciosTotal = servicios.fold<double>(0, (suma, s) => suma + (s['amount'] as num).toDouble());
  final manoTotal = manoDeObra.fold<double>(0, (suma, s) => suma + (s['amount'] as num).toDouble());
  return {
    'id': 3,
    'folio': 'OS-2026-0003',
    'status': estado,
    'clientId': 1,
    'clientName': 'Ana Pérez',
    'vehicleId': 7,
    'vehicleLabel': 'ABC1234 · Nissan Versa 2020',
    'mechanicId': mecanicoId,
    'mechanicName': 'Mecánico Uno',
    'entryMileage': 45800,
    'previousMileage': 45000,
    'mileageCorrectionReason': null,
    'appointmentId': null,
    'reportedProblem': 'Ruido al frenar',
    'diagnosis': 'Balatas gastadas',
    'notes': null,
    'recommendations': null,
    'cancelReason': null,
    'deliveredAt': null,
    'services': servicios,
    'labor': manoDeObra,
    'servicesTotal': serviciosTotal,
    'laborTotal': manoTotal,
    'total': serviciosTotal + manoTotal,
    'history': <Object>[],
    'allowedTransitions': <Object>[],
    'createdAt': '2026-10-13T10:00:00.000Z',
    'updatedAt': '2026-10-13T10:00:00.000Z',
  };
}

Map<String, dynamic> linea(int id, String descripcion, double importe) =>
    {'id': id, 'description': descripcion, 'amount': importe};

Future<List<http.Request>> abrirDetalle(
  WidgetTester tester, {
  required String role,
  required FakeHandler handler,
}) async {
  tester.view.physicalSize = const Size(1400, 1400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  final log = <http.Request>[];
  final api = fakeApi((request) {
    if (request.url.path.endsWith('/auth/login')) {
      return loginOk(role: role);
    }
    return handler(request);
  }, log: log);
  final auth = AuthProvider(api);
  await auth.login('usuario', 'Clave2026');

  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthProvider>.value(value: auth),
        ChangeNotifierProvider(create: (_) => OrdersProvider(api)),
      ],
      child: MaterialApp(
        theme: buildAppTheme(useGoogleFonts: false),
        home: const OrderDetailScreen(orderId: 3),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return log;
}

FakeHandler devuelve(Map<String, dynamic> detalle) => (request) => FakeResponse(200, {'data': detalle});

void main() {
  testWidgets('el mecánico asignado ve los botones de edición del contenido técnico', (tester) async {
    await abrirDetalle(tester, role: 'MECHANIC', handler: devuelve(orden()));

    expect(find.text('Editar diagnóstico'), findsOneWidget);
    expect(find.text('Agregar servicio'), findsOneWidget);
    expect(find.text('Agregar mano de obra'), findsOneWidget);
    expect(find.text('Editar observaciones'), findsOneWidget);
    expect(find.text('Editar recomendaciones'), findsOneWidget);
    expect(find.text('Editar problema reportado'), findsNothing, reason: 'el mecánico no edita el problema reportado');
    expect(find.text('Reasignar mecánico'), findsNothing);
  });

  testWidgets('un mecánico que no es el asignado no ve ningún control de edición', (tester) async {
    await abrirDetalle(tester, role: 'MECHANIC', handler: devuelve(orden(mecanicoId: 2)));

    expect(find.text('Editar diagnóstico'), findsNothing);
    expect(find.text('Agregar servicio'), findsNothing);
    expect(find.text('Editar observaciones'), findsNothing);
  });

  testWidgets('recepción edita el problema reportado pero no el contenido técnico', (tester) async {
    await abrirDetalle(tester, role: 'RECEPTIONIST', handler: devuelve(orden()));

    expect(find.text('Editar problema reportado'), findsOneWidget);
    expect(find.text('Reasignar mecánico'), findsOneWidget);
    expect(find.text('Editar diagnóstico'), findsNothing);
    expect(find.text('Agregar servicio'), findsNothing);
    expect(find.text('Agregar mano de obra'), findsNothing);
  });

  testWidgets('el administrador ve todos los controles de edición', (tester) async {
    await abrirDetalle(tester, role: 'ADMIN', handler: devuelve(orden()));

    expect(find.text('Editar problema reportado'), findsOneWidget);
    expect(find.text('Editar diagnóstico'), findsOneWidget);
    expect(find.text('Agregar servicio'), findsOneWidget);
  });

  testWidgets('agregar un servicio envía el importe y actualiza el total', (tester) async {
    final servicioNuevo = linea(11, 'Cambio de balatas', 1200.5);
    final log = await abrirDetalle(tester, role: 'MECHANIC', handler: (request) {
      if (request.method == 'POST' && request.url.path.endsWith('/orders/3/services')) {
        return FakeResponse(201, {
          'data': orden(servicios: [servicioNuevo]),
        });
      }
      return FakeResponse(200, {'data': orden()});
    });
    expect(find.text('Total: \$0.00'), findsOneWidget);

    await tester.tap(find.text('Agregar servicio'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Descripción'), 'Cambio de balatas');
    await tester.enterText(find.widgetWithText(TextFormField, 'Importe'), '1200.50');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    final post = log.firstWhere((r) => r.method == 'POST' && r.url.path.endsWith('/services'));
    expect(jsonDecode(post.body), {'description': 'Cambio de balatas', 'amount': 1200.5});
    expect(find.text('Cambio de balatas'), findsOneWidget);
    expect(find.text('Total: \$1,200.50'), findsOneWidget);
    expect(find.text('Se agregó el servicio.'), findsOneWidget);
  });

  testWidgets('el diálogo de línea valida la descripción y el importe', (tester) async {
    final log = await abrirDetalle(tester, role: 'MECHANIC', handler: devuelve(orden()));

    await tester.tap(find.text('Agregar servicio'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Guardar'));
    await tester.pump();
    expect(find.text('La descripción es obligatoria.'), findsOneWidget);
    expect(find.text('El importe es obligatorio.'), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextFormField, 'Descripción'), 'Servicio');
    await tester.enterText(find.widgetWithText(TextFormField, 'Importe'), '-5');
    await tester.tap(find.text('Guardar'));
    await tester.pump();
    expect(find.text('El importe no puede ser negativo.'), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextFormField, 'Importe'), '10.123');
    await tester.tap(find.text('Guardar'));
    await tester.pump();
    expect(find.text('El importe admite como máximo dos decimales.'), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextFormField, 'Importe'), 'abc');
    await tester.tap(find.text('Guardar'));
    await tester.pump();
    expect(find.text('Ingresa un importe numérico.'), findsOneWidget);

    expect(log.where((r) => r.method == 'POST' && r.url.path.endsWith('/services')), isEmpty);
  });

  testWidgets('quitar una línea pide confirmación y no llama al servidor si se cancela', (tester) async {
    final detalle = orden(servicios: [linea(11, 'Alineación', 400)]);
    final log = await abrirDetalle(tester, role: 'MECHANIC', handler: (request) {
      if (request.method == 'DELETE') {
        return FakeResponse(200, {'data': orden()});
      }
      return FakeResponse(200, {'data': detalle});
    });

    await tester.tap(find.byTooltip('Quitar Alineación'));
    await tester.pumpAndSettle();
    expect(find.text('¿Seguro que quieres quitar «Alineación» de la orden?'), findsOneWidget);

    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(log.where((r) => r.method == 'DELETE'), isEmpty);

    await tester.tap(find.byTooltip('Quitar Alineación'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();
    expect(log.where((r) => r.method == 'DELETE' && r.url.path.endsWith('/services/11')), hasLength(1));
    expect(find.text('Se quitó el servicio.'), findsOneWidget);
  });

  testWidgets('editar el diagnóstico envía solo ese campo', (tester) async {
    final log = await abrirDetalle(tester, role: 'MECHANIC', handler: (request) {
      if (request.method == 'PATCH') {
        return FakeResponse(200, {'data': orden()..['diagnosis'] = 'Discos rayados'});
      }
      return FakeResponse(200, {'data': orden()});
    });

    await tester.tap(find.text('Editar diagnóstico'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Texto'), 'Discos rayados');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    final patch = log.firstWhere((r) => r.method == 'PATCH');
    expect(jsonDecode(patch.body), {'diagnosis': 'Discos rayados'});
    expect(find.text('Discos rayados'), findsOneWidget);
  });

  testWidgets('en TERMINADO solo quedan los controles de observaciones y recomendaciones', (tester) async {
    await abrirDetalle(tester, role: 'MECHANIC', handler: devuelve(orden(estado: 'TERMINADO')));

    expect(find.text('Editar observaciones'), findsOneWidget);
    expect(find.text('Editar recomendaciones'), findsOneWidget);
    expect(find.text('Editar diagnóstico'), findsNothing);
    expect(find.text('Agregar servicio'), findsNothing);
    expect(find.text('Agregar mano de obra'), findsNothing);
  });

  testWidgets('en ENTREGADO y CANCELADA desaparecen todos los controles de edición', (tester) async {
    for (final estado in ['ENTREGADO', 'CANCELADA']) {
      await abrirDetalle(
        tester,
        role: 'ADMIN',
        handler: devuelve(orden(estado: estado, servicios: [linea(11, 'Alineación', 400)])),
      );
      expect({estado: find.text('Editar diagnóstico').evaluate().length}, {estado: 0});
      expect({estado: find.text('Agregar servicio').evaluate().length}, {estado: 0});
      expect({estado: find.text('Editar observaciones').evaluate().length}, {estado: 0});
      expect({estado: find.text('Editar problema reportado').evaluate().length}, {estado: 0});
      expect({estado: find.byTooltip('Quitar Alineación').evaluate().length}, {estado: 0});
      expect({estado: find.text('Reasignar mecánico').evaluate().length}, {estado: 0});
    }
  });
}
