import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/models/client.dart';
import 'package:motorix_client/models/vehicle.dart';
import 'package:motorix_client/providers/auth_provider.dart';
import 'package:motorix_client/providers/orders_provider.dart';
import 'package:motorix_client/providers/vehicles_provider.dart';
import 'package:motorix_client/screens/order_form_screen.dart';
import 'package:motorix_client/utils/app_theme.dart';
import 'package:provider/provider.dart';

import 'helpers/fake_api.dart';

const cliente = Client(id: 1, name: 'Ana Pérez', phone: '55 1234 5678', email: null, active: true, vehicleCount: 1);

const vehiculo = Vehicle(
  id: 7,
  clientId: 1,
  clientName: 'Ana Pérez',
  brand: 'Nissan',
  model: 'Versa',
  year: 2020,
  licensePlate: 'ABC1234',
  vin: null,
  currentMileage: 45000,
  active: true,
);

Map<String, dynamic> vehiculoJson() => {
      'id': 7,
      'clientId': 1,
      'clientName': 'Ana Pérez',
      'brand': 'Nissan',
      'model': 'Versa',
      'year': 2020,
      'licensePlate': 'ABC1234',
      'vin': null,
      'currentMileage': 45000,
      'active': true,
      'createdAt': '2026-10-12T10:00:00.000Z',
      'updatedAt': '2026-10-12T10:00:00.000Z',
    };

Map<String, dynamic> ordenJson() => {
      'id': 3,
      'folio': 'OS-2026-0003',
      'status': 'RECIBIDO',
      'clientId': 1,
      'clientName': 'Ana Pérez',
      'vehicleId': 7,
      'vehicleLabel': 'ABC1234 · Nissan Versa 2020',
      'mechanicId': 9,
      'mechanicName': 'Mecánico Uno',
      'entryMileage': 45800,
      'previousMileage': 45000,
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
      'total': 0,
      'history': <Object>[],
      'allowedTransitions': <Object>[],
      'createdAt': '2026-10-13T10:00:00.000Z',
      'updatedAt': '2026-10-13T10:00:00.000Z',
    };

FakeResponse servidor(http.Request request, {FakeResponse Function(http.Request)? crear}) {
  final path = request.url.path;
  if (path.endsWith('/mechanics')) {
    return FakeResponse(200, {
      'data': [
        {'id': 9, 'name': 'Mecánico Uno', 'openOrders': 2},
      ],
    });
  }
  if (path.endsWith('/vehicles')) {
    return FakeResponse(200, {
      'data': [vehiculoJson()],
      'meta': {'page': 1, 'pageSize': 100, 'total': 1},
    });
  }
  if (path.endsWith('/orders') && request.method == 'POST') {
    return crear != null ? crear(request) : FakeResponse(201, {'data': ordenJson()});
  }
  return FakeResponse(200, {'data': <Object>[]});
}

/// Monta el formulario con un usuario ya autenticado con el rol indicado.
Future<List<http.Request>> abrirFormulario(
  WidgetTester tester, {
  required String role,
  FakeResponse Function(http.Request)? crear,
  Client? clienteInicial = cliente,
  Vehicle? vehiculoInicial = vehiculo,
  int? citaId,
}) async {
  tester.view.physicalSize = const Size(1400, 1000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  final log = <http.Request>[];
  final api = fakeApi((request) {
    if (request.url.path.endsWith('/auth/login')) {
      return loginOk(role: role);
    }
    return servidor(request, crear: crear);
  }, log: log);
  final auth = AuthProvider(api);
  await auth.login('usuario', 'Clave2026');

  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthProvider>.value(value: auth),
        ChangeNotifierProvider(create: (_) => OrdersProvider(api)),
        ChangeNotifierProvider(create: (_) => VehiclesProvider(api)),
      ],
      child: MaterialApp(
        theme: buildAppTheme(useGoogleFonts: false),
        home: OrderFormScreen(initialClient: clienteInicial, initialVehicle: vehiculoInicial, appointmentId: citaId),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return log;
}

Future<void> elegirMecanico(WidgetTester tester) async {
  await tester.tap(find.text('Mecánico asignado'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Mecánico Uno (2 abiertas)').last);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('valida los campos obligatorios antes de enviar', (tester) async {
    final log = await abrirFormulario(tester, role: 'RECEPTIONIST', clienteInicial: null, vehiculoInicial: null);

    await tester.tap(find.text('Crear orden'));
    await tester.pump();

    expect(find.text('Elige al cliente de la orden.'), findsOneWidget);
    expect(find.text('Elige el vehículo.'), findsOneWidget);
    expect(find.text('Elige al mecánico.'), findsOneWidget);
    expect(find.text('Ingresa un kilometraje entero mayor o igual a 0.'), findsOneWidget);
    expect(find.text('El problema reportado es obligatorio.'), findsOneWidget);
    expect(log.where((r) => r.method == 'POST' && r.url.path.endsWith('/orders')), isEmpty);
  });

  testWidgets('muestra el kilometraje registrado del vehículo y rechaza uno menor', (tester) async {
    await abrirFormulario(tester, role: 'RECEPTIONIST');

    expect(find.text('Kilometraje registrado: 45,000 km'), findsOneWidget);

    await elegirMecanico(tester);
    await tester.enterText(find.widgetWithText(TextFormField, 'Kilometraje de entrada'), '40000');
    await tester.enterText(find.widgetWithText(TextFormField, 'Problema reportado'), 'Ruido al frenar');
    await tester.tap(find.text('Crear orden'));
    await tester.pump();

    expect(find.textContaining('No puede ser menor al registrado (45,000 km)'), findsOneWidget);
  });

  testWidgets('la opción «Corregir kilometraje» solo aparece para el administrador', (tester) async {
    await abrirFormulario(tester, role: 'RECEPTIONIST');
    expect(find.text('Corregir kilometraje'), findsNothing);
  });

  testWidgets('el administrador puede corregir el kilometraje indicando un motivo', (tester) async {
    final log = await abrirFormulario(tester, role: 'ADMIN');
    expect(find.text('Corregir kilometraje'), findsOneWidget);

    await elegirMecanico(tester);
    await tester.enterText(find.widgetWithText(TextFormField, 'Kilometraje de entrada'), '40000');
    await tester.enterText(find.widgetWithText(TextFormField, 'Problema reportado'), 'Ruido al frenar');

    await tester.tap(find.text('Corregir kilometraje'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Crear orden'));
    await tester.pump();
    expect(find.text('Indica el motivo de la corrección.'), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextFormField, 'Motivo de la corrección'), 'Error de captura previo');
    await tester.tap(find.text('Crear orden'));
    await tester.pumpAndSettle();

    final post = log.firstWhere((r) => r.method == 'POST' && r.url.path.endsWith('/orders'));
    final cuerpo = jsonDecode(post.body) as Map<String, dynamic>;
    expect(cuerpo['correctMileage'], isTrue);
    expect(cuerpo['mileageCorrectionReason'], 'Error de captura previo');
    expect(cuerpo['entryMileage'], 40000);
  });

  testWidgets('envía los datos de la orden y cierra el formulario al guardarla', (tester) async {
    final log = await abrirFormulario(tester, role: 'RECEPTIONIST');

    await elegirMecanico(tester);
    await tester.enterText(find.widgetWithText(TextFormField, 'Kilometraje de entrada'), '45800');
    await tester.enterText(find.widgetWithText(TextFormField, 'Problema reportado'), 'Ruido al frenar');
    await tester.tap(find.text('Crear orden'));
    await tester.pumpAndSettle();

    final post = log.firstWhere((r) => r.method == 'POST' && r.url.path.endsWith('/orders'));
    final cuerpo = jsonDecode(post.body) as Map<String, dynamic>;
    expect(cuerpo, {
      'clientId': 1,
      'vehicleId': 7,
      'mechanicId': 9,
      'entryMileage': 45800,
      'reportedProblem': 'Ruido al frenar',
    });
    expect(find.text('Crear orden de servicio'), findsNothing, reason: 'el formulario se cierra al guardar');
  });

  testWidgets('desde una cita envía el identificador de la cita y deja fijo al cliente', (tester) async {
    final log = await abrirFormulario(tester, role: 'RECEPTIONIST', citaId: 12);

    final campoCliente = tester.widget<TextFormField>(find.widgetWithText(TextFormField, 'Ana Pérez'));
    expect(campoCliente.enabled, isFalse);

    await elegirMecanico(tester);
    await tester.enterText(find.widgetWithText(TextFormField, 'Kilometraje de entrada'), '46000');
    await tester.enterText(find.widgetWithText(TextFormField, 'Problema reportado'), 'Revisión');
    await tester.tap(find.text('Crear orden'));
    await tester.pumpAndSettle();

    final post = log.firstWhere((r) => r.method == 'POST' && r.url.path.endsWith('/orders'));
    expect((jsonDecode(post.body) as Map<String, dynamic>)['appointmentId'], 12);
  });

  testWidgets('muestra el mensaje del servidor cuando el vehículo ya tiene una orden abierta', (tester) async {
    await abrirFormulario(
      tester,
      role: 'RECEPTIONIST',
      crear: (_) => apiError(409, 'CONFLICT', 'El vehículo ya tiene una orden abierta (OS-2026-0001). Entrégala o cancélala primero.'),
    );

    await elegirMecanico(tester);
    await tester.enterText(find.widgetWithText(TextFormField, 'Kilometraje de entrada'), '45800');
    await tester.enterText(find.widgetWithText(TextFormField, 'Problema reportado'), 'Ruido al frenar');
    await tester.tap(find.text('Crear orden'));
    await tester.pumpAndSettle();

    expect(find.textContaining('OS-2026-0001'), findsOneWidget);
    expect(find.text('Crear orden de servicio'), findsOneWidget, reason: 'el formulario sigue abierto');
  });
}
