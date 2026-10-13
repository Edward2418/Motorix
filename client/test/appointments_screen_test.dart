import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Map<String, dynamic> cita(
  int id,
  String estado, {
  String cliente = 'Ana Pérez',
  String motivo = 'Revisión general',
  String? folio,
  String fecha = '2030-03-01T16:00:00.000Z',
}) =>
    {
      'id': id,
      'clientId': 1,
      'clientName': cliente,
      'vehicleId': 7,
      'vehicleLabel': 'ABC1234 · Nissan Versa 2020',
      'scheduledAt': fecha,
      'reason': motivo,
      'notes': null,
      'status': estado,
      'cancelReason': null,
      'orderId': folio == null ? null : 40 + id,
      'orderFolio': folio,
      'createdAt': '2026-10-13T10:00:00.000Z',
      'updatedAt': '2026-10-13T10:00:00.000Z',
    };

FakeResponse pagina(List<Map<String, dynamic>> citas) => FakeResponse(200, {
      'data': citas,
      'meta': {'page': 1, 'pageSize': 10, 'total': citas.length},
    });

Future<void> abrirCitas(
  WidgetTester tester, {
  required String role,
  required FakeHandler handler,
  List<http.Request>? log,
}) async {
  tester.view.physicalSize = const Size(1700, 900);
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
  if (role != 'MECHANIC') {
    await tester.tap(find.text('Citas').first);
    await tester.pumpAndSettle();
  }
}

FakeHandler conCitas(List<Map<String, dynamic>> citas) =>
    (request) => request.url.path.endsWith('/appointments') ? pagina(citas) : listaVacia();

void main() {
  testWidgets('muestra fecha, cliente, vehículo, motivo, estado y orden de cada cita', (tester) async {
    await abrirCitas(
      tester,
      role: 'RECEPTIONIST',
      handler: conCitas([
        cita(1, 'PENDIENTE', motivo: 'Afinación'),
        cita(2, 'EN_PROCESO', cliente: 'Luis Gómez', folio: 'OS-2026-0007'),
      ]),
    );

    expect(find.text('Afinación'), findsOneWidget);
    expect(find.text('Luis Gómez'), findsOneWidget);
    expect(find.text('Pendiente'), findsWidgets);
    expect(find.text('En proceso'), findsWidgets);
    expect(find.text('OS-2026-0007'), findsOneWidget);
    expect(find.text('ABC1234 · Nissan Versa 2020'), findsWidgets);
    expect(find.text('Registrar cita'), findsOneWidget);
  });

  testWidgets('el mecánico no ve la entrada «Citas» en el menú', (tester) async {
    await abrirCitas(tester, role: 'MECHANIC', handler: conCitas([]));
    expect(find.text('Citas'), findsNothing);
    expect(find.text('Órdenes de servicio'), findsWidgets);
  });

  testWidgets('muestra un estado vacío con la acción de registrar', (tester) async {
    await abrirCitas(tester, role: 'RECEPTIONIST', handler: conCitas([]));
    expect(find.text('Todavía no hay citas registradas.'), findsOneWidget);
    expect(find.text('Registrar cita'), findsWidgets);
  });

  testWidgets('muestra el error en español cuando el listado falla', (tester) async {
    await abrirCitas(
      tester,
      role: 'RECEPTIONIST',
      handler: (request) => request.url.path.endsWith('/appointments')
          ? apiError(503, 'SERVICE_UNAVAILABLE', 'El servicio no está disponible por el momento.')
          : listaVacia(),
    );
    expect(find.text('El servicio no está disponible por el momento.'), findsOneWidget);
    expect(find.text('Reintentar'), findsOneWidget);
  });

  testWidgets('el filtro de estado consulta al servidor y se pueden quitar los filtros', (tester) async {
    final log = <http.Request>[];
    await abrirCitas(tester, role: 'RECEPTIONIST', log: log, handler: conCitas([cita(1, 'PENDIENTE')]));

    await tester.tap(find.text('Todos los estados'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmada').last);
    await tester.pumpAndSettle();
    expect(log.last.url.queryParameters['status'], 'CONFIRMADA');

    await tester.tap(find.text('Quitar filtros'));
    await tester.pumpAndSettle();
    expect(log.last.url.queryParameters.containsKey('status'), isFalse);
  });

  testWidgets('el estado vacío con filtros lo indica', (tester) async {
    await abrirCitas(tester, role: 'RECEPTIONIST', handler: conCitas([]));
    await tester.tap(find.text('Todos los estados'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancelada').last);
    await tester.pumpAndSettle();
    expect(find.text('No se encontraron citas con esos filtros.'), findsOneWidget);
  });

  testWidgets('las acciones dependen del estado: crear orden solo en citas PENDIENTE o CONFIRMADA', (tester) async {
    await abrirCitas(
      tester,
      role: 'RECEPTIONIST',
      handler: conCitas([
        cita(1, 'PENDIENTE'),
        cita(2, 'CONFIRMADA', motivo: 'Segunda'),
        cita(3, 'COMPLETADA', motivo: 'Tercera'),
        cita(4, 'CANCELADA', motivo: 'Cuarta'),
      ]),
    );

    expect(find.byTooltip('Crear orden'), findsNWidgets(2));
    expect(find.byTooltip('Confirmar cita'), findsOneWidget, reason: 'solo la PENDIENTE se confirma');
    expect(find.byTooltip('Modificar cita'), findsNWidgets(2));
    expect(find.byTooltip('Cancelar cita'), findsNWidgets(2));
  });

  testWidgets('confirmar una cita llama al servidor y avisa el resultado', (tester) async {
    final log = <http.Request>[];
    await abrirCitas(tester, role: 'RECEPTIONIST', log: log, handler: (request) {
      if (request.method == 'POST' && request.url.path.endsWith('/appointments/1/confirm')) {
        return FakeResponse(200, {'data': cita(1, 'CONFIRMADA')});
      }
      return request.url.path.endsWith('/appointments') ? pagina([cita(1, 'PENDIENTE')]) : listaVacia();
    });

    await tester.tap(find.byTooltip('Confirmar cita'));
    await tester.pumpAndSettle();

    expect(log.where((r) => r.method == 'POST' && r.url.path.endsWith('/appointments/1/confirm')), hasLength(1));
    expect(find.text('Cita confirmada.'), findsOneWidget);
  });

  testWidgets('cancelar una cita pide confirmación, el motivo es opcional y no llama al servidor si se cancela', (tester) async {
    final log = <http.Request>[];
    await abrirCitas(tester, role: 'RECEPTIONIST', log: log, handler: (request) {
      if (request.method == 'POST' && request.url.path.endsWith('/appointments/1/cancel')) {
        return FakeResponse(200, {'data': cita(1, 'CANCELADA')});
      }
      return request.url.path.endsWith('/appointments') ? pagina([cita(1, 'PENDIENTE')]) : listaVacia();
    });

    await tester.tap(find.byTooltip('Cancelar cita'));
    await tester.pumpAndSettle();
    expect(find.textContaining('¿Seguro que quieres cancelar la cita de Ana Pérez'), findsOneWidget);

    await tester.tap(find.text('Cancelar').last);
    await tester.pumpAndSettle();
    expect(log.where((r) => r.url.path.endsWith('/cancel')), isEmpty);

    await tester.tap(find.byTooltip('Cancelar cita'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextField, 'Motivo (opcional)'), 'No puede asistir');
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();

    final peticion = log.singleWhere((r) => r.url.path.endsWith('/appointments/1/cancel'));
    expect(jsonDecode(peticion.body), {'reason': 'No puede asistir'});
    expect(find.text('Cita cancelada.'), findsOneWidget);
  });

  testWidgets('cancelar sin motivo envía el motivo vacío como nulo', (tester) async {
    final log = <http.Request>[];
    await abrirCitas(tester, role: 'RECEPTIONIST', log: log, handler: (request) {
      if (request.method == 'POST') {
        return FakeResponse(200, {'data': cita(1, 'CANCELADA')});
      }
      return request.url.path.endsWith('/appointments') ? pagina([cita(1, 'CONFIRMADA')]) : listaVacia();
    });

    await tester.tap(find.byTooltip('Cancelar cita'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();

    expect(jsonDecode(log.singleWhere((r) => r.url.path.endsWith('/cancel')).body), {'reason': null});
  });

  testWidgets('muestra el mensaje del servidor si la cita ya tiene una orden', (tester) async {
    await abrirCitas(tester, role: 'RECEPTIONIST', handler: (request) {
      if (request.method == 'POST') {
        return apiError(409, 'CONFLICT', 'La cita ya tiene la orden OS-2026-0007 vinculada. Para cancelarla, cancela primero la orden.');
      }
      return request.url.path.endsWith('/appointments') ? pagina([cita(1, 'CONFIRMADA')]) : listaVacia();
    });

    await tester.tap(find.byTooltip('Cancelar cita'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();

    expect(find.textContaining('cancela primero la orden'), findsOneWidget);
  });

  testWidgets('el formulario de alta valida los campos obligatorios', (tester) async {
    await abrirCitas(tester, role: 'RECEPTIONIST', handler: conCitas([cita(1, 'PENDIENTE')]));

    await tester.tap(find.text('Registrar cita').first);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Registrar cita'));
    await tester.pump();

    expect(find.text('Elige al cliente de la cita.'), findsOneWidget);
    expect(find.text('Elige el vehículo.'), findsOneWidget);
    expect(find.text('Elige la fecha y la hora de la cita.'), findsOneWidget);
    expect(find.text('El motivo es obligatorio.'), findsOneWidget);
  });

  testWidgets('el formulario de edición llega precargado, sin poder cambiar cliente ni vehículo', (tester) async {
    await abrirCitas(tester, role: 'RECEPTIONIST', handler: conCitas([cita(1, 'PENDIENTE', motivo: 'Afinación')]));

    await tester.tap(find.byTooltip('Modificar cita'));
    await tester.pumpAndSettle();

    expect(find.text('Modificar cita'), findsWidgets);
    expect(find.widgetWithText(TextFormField, 'Afinación'), findsOneWidget);
    final vehiculo = tester.widget<TextFormField>(find.widgetWithText(TextFormField, 'ABC1234 · Nissan Versa 2020'));
    expect(vehiculo.enabled, isFalse);
  });
}
