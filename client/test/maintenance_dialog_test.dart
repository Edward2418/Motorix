import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/providers/auth_provider.dart';
import 'package:motorix_client/providers/maintenance_provider.dart';
import 'package:motorix_client/providers/orders_provider.dart';
import 'package:motorix_client/providers/payments_provider.dart';
import 'package:motorix_client/screens/order_detail_screen.dart';
import 'package:motorix_client/utils/app_theme.dart';
import 'package:provider/provider.dart';

import 'helpers/fake_api.dart';
import 'order_status_actions_test.dart' show orden;

Map<String, dynamic> mantenimientoJson({
  int id = 5,
  String descripcion = 'Cambio de aceite',
  String estado = 'PROGRAMADO',
  String? visual = 'PROXIMO',
  String? motivo,
}) =>
    {
      'id': id,
      'vehicleId': 7,
      'vehicleLabel': 'ABC1234 · Nissan Versa 2020',
      'currentMileage': 45800,
      'clientId': 1,
      'clientName': 'Ana Pérez',
      'clientPhone': '5551234567',
      'orderId': 3,
      'orderFolio': 'OS-2026-0003',
      'description': descripcion,
      'dueDate': '2027-01-15',
      'dueMileage': 50000,
      'notes': null,
      'status': estado,
      'visualStatus': visual,
      'remainingDays': 20,
      'remainingKm': 4200,
      'cancelReason': motivo,
      'fulfilledOrderId': null,
      'closedAt': null,
      'createdAt': '2026-10-13T10:00:00.000Z',
    };

Map<String, dynamic> ordenConMantenimientos(
  List<Map<String, dynamic>> mantenimientos, {
  String estado = 'EN_REPARACION',
  int mecanicoId = 1,
}) =>
    {...orden(estado: estado), 'mechanicId': mecanicoId, 'maintenance': mantenimientos};

Future<List<http.Request>> abrirDetalle(
  WidgetTester tester, {
  required String role,
  required FakeHandler handler,
}) async {
  tester.view.physicalSize = const Size(1400, 2000);
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
        ChangeNotifierProvider(create: (_) => PaymentsProvider(api)),
        ChangeNotifierProvider(create: (_) => MaintenanceProvider(api)),
      ],
      child: MaterialApp(theme: buildAppTheme(useGoogleFonts: false), home: const OrderDetailScreen(orderId: 3)),
    ),
  );
  await tester.pumpAndSettle();
  return log;
}

FakeHandler servidor(Map<String, dynamic> detalle, {FakeResponse Function(http.Request)? ante}) => (request) {
      if (request.url.path.contains('/maintenance') && ante != null) {
        return ante(request);
      }
      return FakeResponse(200, {'data': detalle});
    };

Iterable<http.Request> llamadas(List<http.Request> log, String sufijo) =>
    log.where((r) => r.method == 'POST' && r.url.path.endsWith(sufijo));

Future<void> abrirDialogo(WidgetTester tester) async {
  await tester.tap(find.text('Programar mantenimiento'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('el mecánico asignado ve los mantenimientos de la orden con su estado visual', (tester) async {
    await abrirDetalle(
      tester,
      role: 'MECHANIC',
      handler: servidor(ordenConMantenimientos([
        mantenimientoJson(),
        mantenimientoJson(id: 6, descripcion: 'Frenos', visual: 'VENCIDO'),
        mantenimientoJson(id: 7, descripcion: 'Llantas', estado: 'CANCELADO', visual: null, motivo: 'El cliente lo pospuso'),
      ])),
    );

    expect(find.text('Próximo mantenimiento'), findsOneWidget);
    expect(find.text('Cambio de aceite'), findsOneWidget);
    expect(find.text('Próximo'), findsOneWidget);
    expect(find.text('Vencido'), findsOneWidget);
    expect(find.text('Cancelado'), findsOneWidget);
    expect(find.textContaining('Motivo: El cliente lo pospuso'), findsOneWidget);
    expect(find.text('Programar mantenimiento'), findsOneWidget);
  });

  testWidgets('exige una fecha o un kilometraje antes de llamar al servidor', (tester) async {
    final log = await abrirDetalle(tester, role: 'MECHANIC', handler: servidor(ordenConMantenimientos([])));

    await abrirDialogo(tester);
    await tester.enterText(find.widgetWithText(TextFormField, 'Descripción'), 'Cambio de aceite');
    await tester.tap(find.widgetWithText(FilledButton, 'Programar'));
    await tester.pumpAndSettle();

    expect(find.text('Indica una fecha, un kilometraje o ambos.'), findsOneWidget);
    expect(llamadas(log, '/orders/3/maintenance'), isEmpty);
  });

  testWidgets('la descripción es obligatoria', (tester) async {
    final log = await abrirDetalle(tester, role: 'MECHANIC', handler: servidor(ordenConMantenimientos([])));

    await abrirDialogo(tester);
    await tester.enterText(find.widgetWithText(TextFormField, 'Kilometraje objetivo (opcional)'), '50000');
    await tester.tap(find.widgetWithText(FilledButton, 'Programar'));
    await tester.pumpAndSettle();

    expect(find.text('La descripción es obligatoria.'), findsOneWidget);
    expect(llamadas(log, '/orders/3/maintenance'), isEmpty);
  });

  testWidgets('programa el mantenimiento por kilometraje y vuelve a cargar la orden', (tester) async {
    var creado = false;
    final log = await abrirDetalle(
      tester,
      role: 'MECHANIC',
      handler: (request) {
        if (request.method == 'POST' && request.url.path.endsWith('/orders/3/maintenance')) {
          creado = true;
          return FakeResponse(201, {'data': mantenimientoJson()});
        }
        return FakeResponse(200, {'data': ordenConMantenimientos(creado ? [mantenimientoJson()] : [])});
      },
    );

    await abrirDialogo(tester);
    await tester.enterText(find.widgetWithText(TextFormField, 'Descripción'), 'Cambio de aceite');
    await tester.enterText(find.widgetWithText(TextFormField, 'Kilometraje objetivo (opcional)'), '50000');
    await tester.tap(find.widgetWithText(FilledButton, 'Programar'));
    await tester.pumpAndSettle();

    expect(jsonDecode(llamadas(log, '/orders/3/maintenance').single.body), {'description': 'Cambio de aceite', 'dueMileage': 50000});
    expect(find.text('Mantenimiento programado.'), findsOneWidget);
    expect(find.text('Cambio de aceite'), findsOneWidget);
  });

  testWidgets('el error de mantenimiento duplicado se muestra sin cerrar el diálogo', (tester) async {
    await abrirDetalle(
      tester,
      role: 'MECHANIC',
      handler: servidor(ordenConMantenimientos([]), ante: (_) {
        return apiError(409, 'DUPLICATE_MAINTENANCE', 'Ya existe un mantenimiento pendiente con esa descripción para este vehículo (n.º 4).');
      }),
    );

    await abrirDialogo(tester);
    await tester.enterText(find.widgetWithText(TextFormField, 'Descripción'), 'Cambio de aceite');
    await tester.enterText(find.widgetWithText(TextFormField, 'Kilometraje objetivo (opcional)'), '50000');
    await tester.tap(find.widgetWithText(FilledButton, 'Programar'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Ya existe un mantenimiento pendiente'), findsOneWidget);
    expect(find.text('Programar próximo mantenimiento'), findsOneWidget, reason: 'el diálogo sigue abierto');
  });

  testWidgets('los errores por campo del servidor se muestran junto al campo', (tester) async {
    await abrirDetalle(
      tester,
      role: 'MECHANIC',
      handler: servidor(ordenConMantenimientos([]), ante: (_) {
        return apiError(400, 'VALIDATION_ERROR', 'El kilometraje objetivo debe ser mayor al actual del vehículo (45,800 km).',
            details: [
              {'field': 'dueMileage', 'message': 'El kilometraje objetivo debe ser mayor al actual del vehículo (45,800 km).'},
            ]);
      }),
    );

    await abrirDialogo(tester);
    await tester.enterText(find.widgetWithText(TextFormField, 'Descripción'), 'Frenos');
    await tester.enterText(find.widgetWithText(TextFormField, 'Kilometraje objetivo (opcional)'), '100');
    await tester.tap(find.widgetWithText(FilledButton, 'Programar'));
    await tester.pumpAndSettle();

    expect(find.text('El kilometraje objetivo debe ser mayor al actual del vehículo (45,800 km).'), findsOneWidget);
  });

  testWidgets('un mecánico que no es el de la orden no puede programar ni cerrar mantenimientos', (tester) async {
    await abrirDetalle(
      tester,
      role: 'MECHANIC',
      handler: servidor(ordenConMantenimientos([mantenimientoJson()], mecanicoId: 2)),
    );

    expect(find.text('Cambio de aceite'), findsOneWidget);
    expect(find.text('Programar mantenimiento'), findsNothing);
    expect(find.byTooltip('Marcar atendido Cambio de aceite'), findsNothing);
  });

  testWidgets('en una orden cancelada no se programan ni cierran mantenimientos', (tester) async {
    await abrirDetalle(
      tester,
      role: 'ADMIN',
      handler: servidor(ordenConMantenimientos([mantenimientoJson(estado: 'CANCELADO', visual: null, motivo: 'Orden cancelada')], estado: 'CANCELADA')),
    );

    expect(find.text('Programar mantenimiento'), findsNothing);
    expect(find.byTooltip('Cancelar mantenimiento Cambio de aceite'), findsNothing);
  });

  testWidgets('marcar atendido pide confirmación antes de llamar al servidor', (tester) async {
    final log = await abrirDetalle(
      tester,
      role: 'RECEPTIONIST',
      handler: servidor(ordenConMantenimientos([mantenimientoJson()]), ante: (_) {
        return FakeResponse(200, {'data': mantenimientoJson(estado: 'ATENDIDO', visual: null)});
      }),
    );

    await tester.tap(find.byTooltip('Marcar atendido Cambio de aceite'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(llamadas(log, '/maintenance/5/fulfill'), isEmpty);

    await tester.tap(find.byTooltip('Marcar atendido Cambio de aceite'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();
    expect(llamadas(log, '/maintenance/5/fulfill'), hasLength(1));
    expect(find.text('Mantenimiento atendido.'), findsOneWidget);
  });

  testWidgets('cancelar el mantenimiento exige el motivo y lo envía', (tester) async {
    final log = await abrirDetalle(
      tester,
      role: 'ADMIN',
      handler: servidor(ordenConMantenimientos([mantenimientoJson()]), ante: (_) {
        return FakeResponse(200, {'data': mantenimientoJson(estado: 'CANCELADO', visual: null, motivo: 'El cliente lo pospuso')});
      }),
    );

    await tester.tap(find.byTooltip('Cancelar mantenimiento Cambio de aceite'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar'));
    await tester.pump();
    expect(find.text('Indica el motivo.'), findsOneWidget);
    expect(llamadas(log, '/maintenance/5/cancel'), isEmpty);

    await tester.enterText(find.widgetWithText(TextFormField, 'Motivo de la cancelación'), 'El cliente lo pospuso');
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();
    expect(jsonDecode(llamadas(log, '/maintenance/5/cancel').single.body), {'reason': 'El cliente lo pospuso'});
    expect(find.text('Mantenimiento cancelado.'), findsOneWidget);
  });
}
