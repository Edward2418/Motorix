import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Map<String, dynamic> ordenResumen(int id, String folio, String estado, {String cliente = 'Ana Pérez', double total = 0}) => {
      'id': id,
      'folio': folio,
      'status': estado,
      'clientId': 1,
      'clientName': cliente,
      'vehicleId': 7,
      'vehicleLabel': 'ABC123$id · Nissan Versa 2020',
      'mechanicId': 9,
      'mechanicName': 'Mecánico Uno',
      'entryMileage': 45000,
      'total': total,
      'createdAt': '2026-10-13T10:00:00.000Z',
      'updatedAt': '2026-10-13T10:00:00.000Z',
    };

FakeResponse pagina(List<Map<String, dynamic>> ordenes) => FakeResponse(200, {
      'data': ordenes,
      'meta': {'page': 1, 'pageSize': 10, 'total': ordenes.length},
    });

Future<void> abrirOrdenes(
  WidgetTester tester, {
  required String role,
  required FakeHandler handler,
  List<http.Request>? log,
}) async {
  tester.view.physicalSize = const Size(1400, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final api = fakeApi((request) {
    if (request.url.path.endsWith('/auth/login')) {
      return loginOk(role: role);
    }
    return handler(request);
  }, log: log);
  await tester.pumpWidget(MotorixApp(api: api, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.widgetWithText(TextFormField, 'Usuario o correo electrónico'), 'usuario');
  await tester.enterText(find.widgetWithText(TextFormField, 'Contraseña'), 'Clave2026');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Órdenes de servicio').first);
  await tester.pumpAndSettle();
}

FakeHandler conOrdenes(List<Map<String, dynamic>> ordenes) =>
    (request) => request.url.path.endsWith('/orders') ? pagina(ordenes) : listaVacia();

void main() {
  testWidgets('muestra la tabla con folio, cliente, vehículo, mecánico, estado y total', (tester) async {
    await abrirOrdenes(
      tester,
      role: 'RECEPTIONIST',
      handler: conOrdenes([
        ordenResumen(1, 'OS-2026-0001', 'EN_REPARACION', total: 1550.75),
        ordenResumen(2, 'OS-2026-0002', 'ENTREGADO', cliente: 'Luis Gómez'),
      ]),
    );

    expect(find.text('OS-2026-0001'), findsOneWidget);
    expect(find.text('Luis Gómez'), findsOneWidget);
    expect(find.text('En reparación'), findsOneWidget);
    expect(find.text('Entregado'), findsOneWidget);
    expect(find.text(r'$1,550.75'), findsOneWidget);
    expect(find.text('Crear orden'), findsOneWidget);
  });

  testWidgets('el mecánico ve sus órdenes y no tiene el botón para crear', (tester) async {
    await abrirOrdenes(tester, role: 'MECHANIC', handler: conOrdenes([ordenResumen(1, 'OS-2026-0001', 'RECIBIDO')]));

    expect(find.text('OS-2026-0001'), findsOneWidget);
    expect(find.text('Crear orden'), findsNothing, reason: 'solo recepción y administración crean órdenes');
  });

  testWidgets('el mecánico sin órdenes ve un mensaje claro', (tester) async {
    await abrirOrdenes(tester, role: 'MECHANIC', handler: conOrdenes([]));
    expect(find.text('No tienes órdenes asignadas por el momento.'), findsOneWidget);
  });

  testWidgets('recepción sin órdenes ve el estado vacío con la acción de crear', (tester) async {
    await abrirOrdenes(tester, role: 'RECEPTIONIST', handler: conOrdenes([]));
    expect(find.text('Todavía no hay órdenes de servicio.'), findsOneWidget);
    expect(find.text('Crear orden'), findsWidgets);
  });

  testWidgets('muestra el error en español cuando el listado falla', (tester) async {
    await abrirOrdenes(
      tester,
      role: 'RECEPTIONIST',
      handler: (request) => request.url.path.endsWith('/orders')
          ? apiError(503, 'SERVICE_UNAVAILABLE', 'El servicio no está disponible por el momento.')
          : listaVacia(),
    );
    expect(find.text('El servicio no está disponible por el momento.'), findsOneWidget);
    expect(find.text('Reintentar'), findsOneWidget);
  });

  testWidgets('la búsqueda y el filtro de estado consultan al servidor', (tester) async {
    final log = <http.Request>[];
    await abrirOrdenes(
      tester,
      role: 'RECEPTIONIST',
      log: log,
      handler: conOrdenes([ordenResumen(1, 'OS-2026-0001', 'RECIBIDO')]),
    );

    await tester.enterText(find.byType(TextField).first, 'ABC');
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();
    expect(log.last.url.queryParameters['search'], 'ABC');

    await tester.tap(find.text('Todos los estados'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Terminado').last);
    await tester.pumpAndSettle();
    expect(log.last.url.queryParameters['status'], 'TERMINADO');
  });

  testWidgets('abre el detalle de la orden al pulsar una fila', (tester) async {
    final detalle = {
      ...ordenResumen(1, 'OS-2026-0001', 'RECIBIDO'),
      'previousMileage': 44000,
      'mileageCorrectionReason': null,
      'appointmentId': null,
      'reportedProblem': 'Ruido al frenar',
      'diagnosis': null,
      'notes': null,
      'recommendations': null,
      'cancelReason': null,
      'deliveredAt': null,
      'services': <Object>[],
      'labor': <Object>[],
      'servicesTotal': 0,
      'laborTotal': 0,
      'history': <Object>[],
      'allowedTransitions': <Object>[],
    };
    await abrirOrdenes(
      tester,
      role: 'RECEPTIONIST',
      handler: (request) {
        if (request.url.path.endsWith('/orders/1')) {
          return FakeResponse(200, {'data': detalle});
        }
        return request.url.path.endsWith('/orders') ? pagina([ordenResumen(1, 'OS-2026-0001', 'RECIBIDO')]) : listaVacia();
      },
    );

    await tester.tap(find.text('OS-2026-0001'));
    await tester.pumpAndSettle();

    expect(find.text('Orden OS-2026-0001'), findsOneWidget);
    expect(find.text('Ruido al frenar'), findsOneWidget);
    expect(find.text('Reasignar mecánico'), findsOneWidget);
  });
}
