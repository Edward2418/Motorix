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

Map<String, dynamic> orden({
  String estado = 'EN_REPARACION',
  List<String> permitidas = const ['ESPERANDO_REFACCION', 'TERMINADO'],
  List<Map<String, dynamic>>? historial,
  String? motivoCancelacion,
}) =>
    {
      'id': 3,
      'folio': 'OS-2026-0003',
      'status': estado,
      'clientId': 1,
      'clientName': 'Ana Pérez',
      'vehicleId': 7,
      'vehicleLabel': 'ABC1234 · Nissan Versa 2020',
      'mechanicId': 1,
      'mechanicName': 'Mecánico Uno',
      'entryMileage': 45800,
      'previousMileage': 45000,
      'mileageCorrectionReason': null,
      'appointmentId': null,
      'reportedProblem': 'Ruido al frenar',
      'diagnosis': null,
      'notes': null,
      'recommendations': null,
      'cancelReason': motivoCancelacion,
      'deliveredAt': null,
      'services': <Object>[],
      'labor': <Object>[],
      'servicesTotal': 0,
      'laborTotal': 0,
      'total': 0,
      'history': historial ??
          [
            {
              'fromStatus': null,
              'toStatus': 'RECIBIDO',
              'changedBy': 'Recepción Uno',
              'reason': null,
              'changedAt': '2026-10-13T10:00:00.000Z',
            },
            {
              'fromStatus': 'RECIBIDO',
              'toStatus': 'DIAGNOSTICO',
              'changedBy': 'Mecánico Uno',
              'reason': null,
              'changedAt': '2026-10-13T11:30:00.000Z',
            },
          ],
      'allowedTransitions': permitidas,
      'createdAt': '2026-10-13T10:00:00.000Z',
      'updatedAt': '2026-10-13T10:00:00.000Z',
    };

Future<List<http.Request>> abrirDetalle(
  WidgetTester tester, {
  required String role,
  required FakeHandler handler,
}) async {
  tester.view.physicalSize = const Size(1400, 1600);
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

Iterable<http.Request> cambios(List<http.Request> log) =>
    log.where((r) => r.method == 'POST' && r.url.path.endsWith('/orders/3/status'));

void main() {
  testWidgets('el mecánico asignado solo ve los botones de las transiciones permitidas', (tester) async {
    await abrirDetalle(tester, role: 'MECHANIC', handler: devuelve(orden()));

    expect(find.text('Esperar refacción'), findsOneWidget);
    expect(find.text('Marcar como terminada'), findsOneWidget);
    expect(find.text('Entregar'), findsNothing);
    expect(find.text('Cancelar orden'), findsNothing);
    expect(find.text('Reasignar mecánico'), findsNothing);
  });

  testWidgets('recepción ve las acciones de estado, cancelar y reasignar', (tester) async {
    await abrirDetalle(
      tester,
      role: 'RECEPTIONIST',
      handler: devuelve(orden(permitidas: ['ESPERANDO_REFACCION', 'TERMINADO', 'CANCELADA'])),
    );

    expect(find.text('Marcar como terminada'), findsOneWidget);
    expect(find.text('Cancelar orden'), findsOneWidget);
    expect(find.text('Reasignar mecánico'), findsOneWidget);
  });

  testWidgets('en TERMINADO recepción ve «Entregar» y no puede cancelar', (tester) async {
    await abrirDetalle(
      tester,
      role: 'RECEPTIONIST',
      handler: devuelve(orden(estado: 'TERMINADO', permitidas: ['ENTREGADO'])),
    );
    expect(find.text('Entregar'), findsOneWidget);
    expect(find.text('Cancelar orden'), findsNothing);
  });

  testWidgets('en TERMINADO el mecánico no ve ninguna acción de estado', (tester) async {
    await abrirDetalle(tester, role: 'MECHANIC', handler: devuelve(orden(estado: 'TERMINADO', permitidas: [])));
    expect(find.text('Entregar'), findsNothing);
    expect(find.text('Marcar como terminada'), findsNothing);
    expect(find.text('Cancelar orden'), findsNothing);
  });

  for (final estado in ['ENTREGADO', 'CANCELADA']) {
    testWidgets('en estado $estado no hay acciones de estado ni reasignación', (tester) async {
      await abrirDetalle(
        tester,
        role: 'ADMIN',
        handler: devuelve(
          orden(
            estado: estado,
            permitidas: [],
            motivoCancelacion: estado == 'CANCELADA' ? 'Cliente se arrepintió' : null,
          ),
        ),
      );
      expect(find.text('Entregar'), findsNothing);
      expect(find.text('Cancelar orden'), findsNothing);
      expect(find.text('Reasignar mecánico'), findsNothing);
    });
  }

  testWidgets('un cambio de estado intermedio se aplica pidiendo solo el kilometraje al terminar', (tester) async {
    final log = await abrirDetalle(tester, role: 'MECHANIC', handler: (request) {
      if (request.method == 'POST') {
        return FakeResponse(200, {
          'data': orden(estado: 'TERMINADO', permitidas: []),
        });
      }
      return FakeResponse(200, {'data': orden()});
    });

    await tester.tap(find.text('Marcar como terminada'));
    await tester.pumpAndSettle();
    expect(find.text('Kilometraje del servicio'), findsWidgets, reason: 'terminar pide el kilometraje del servicio');
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();

    final peticion = cambios(log).single;
    expect(jsonDecode(peticion.body), {'status': 'TERMINADO', 'serviceMileage': 45800});
    expect(find.text('La orden pasó a «Terminado».'), findsOneWidget);
    expect(find.text('Marcar como terminada'), findsNothing, reason: 'ya no hay acciones disponibles');
  });

  testWidgets('entregar pide confirmación y no llama al servidor si se cancela', (tester) async {
    final log = await abrirDetalle(tester, role: 'RECEPTIONIST', handler: (request) {
      if (request.method == 'POST') {
        return FakeResponse(200, {'data': orden(estado: 'ENTREGADO', permitidas: [])});
      }
      return FakeResponse(200, {'data': orden(estado: 'TERMINADO', permitidas: ['ENTREGADO'])});
    });

    await tester.tap(find.text('Entregar'));
    await tester.pumpAndSettle();
    expect(find.textContaining('¿Seguro que quieres marcar la orden OS-2026-0003 como entregada?'), findsOneWidget);

    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(cambios(log), isEmpty);

    await tester.tap(find.text('Entregar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();
    expect(jsonDecode(cambios(log).single.body), {'status': 'ENTREGADO'});
    expect(find.text('La orden pasó a «Entregado».'), findsOneWidget);
  });

  testWidgets('cancelar la orden exige un motivo y confirma antes de llamar al servidor', (tester) async {
    final log = await abrirDetalle(tester, role: 'RECEPTIONIST', handler: (request) {
      if (request.method == 'POST') {
        return FakeResponse(200, {
          'data': orden(estado: 'CANCELADA', permitidas: [], motivoCancelacion: 'El cliente ya no quiere el servicio'),
        });
      }
      return FakeResponse(200, {
        'data': orden(permitidas: ['ESPERANDO_REFACCION', 'TERMINADO', 'CANCELADA']),
      });
    });

    await tester.tap(find.text('Cancelar orden'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Confirmar'));
    await tester.pump();
    expect(find.text('Indica el motivo de la cancelación.'), findsOneWidget);
    expect(cambios(log), isEmpty, reason: 'sin motivo no se envía nada');

    await tester.enterText(find.widgetWithText(TextFormField, 'Motivo de la cancelación'), 'El cliente ya no quiere el servicio');
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();

    expect(jsonDecode(cambios(log).single.body), {'status': 'CANCELADA', 'reason': 'El cliente ya no quiere el servicio'});
    expect(find.text('Motivo de cancelación: El cliente ya no quiere el servicio'), findsOneWidget);
  });

  testWidgets('cancelar el diálogo de cancelación no llama al servidor', (tester) async {
    final log = await abrirDetalle(
      tester,
      role: 'ADMIN',
      handler: devuelve(orden(permitidas: ['TERMINADO', 'CANCELADA'])),
    );

    await tester.tap(find.text('Cancelar orden'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancelar').last);
    await tester.pumpAndSettle();

    expect(cambios(log), isEmpty);
    expect(find.text('Cancelar orden'), findsOneWidget, reason: 'la orden sigue abierta');
  });

  testWidgets('muestra el mensaje del servidor ante una transición inválida', (tester) async {
    await abrirDetalle(tester, role: 'MECHANIC', handler: (request) {
      if (request.method == 'POST') {
        return apiError(
          409,
          'INVALID_TRANSITION',
          'No se puede pasar de EN_REPARACION a TERMINADO. Estados permitidos desde EN_REPARACION: ESPERANDO_REFACCION.',
        );
      }
      return FakeResponse(200, {'data': orden()});
    });

    await tester.tap(find.text('Marcar como terminada'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Estados permitidos desde EN_REPARACION'), findsOneWidget);
    expect(find.text('Marcar como terminada'), findsOneWidget, reason: 'la orden no cambió de estado');
  });

  testWidgets('el historial muestra los cambios en orden cronológico con quién los hizo', (tester) async {
    await abrirDetalle(tester, role: 'ADMIN', handler: devuelve(orden()));

    expect(find.text('Historial de estados'), findsOneWidget);
    final registrada = tester.getTopLeft(find.text('Orden registrada como «Recibido»'));
    final cambio = tester.getTopLeft(find.text('Recibido → Diagnóstico'));
    expect(registrada.dy, lessThan(cambio.dy), reason: 'el cambio más antiguo va primero');
    expect(find.text('Por Recepción Uno'), findsOneWidget);
    expect(find.text('Por Mecánico Uno'), findsWidgets);
  });
}
