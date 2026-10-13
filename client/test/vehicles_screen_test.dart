import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Map<String, dynamic> vehicleJson(int id, String plate, {bool active = true, String owner = 'Ana Pérez'}) => {
      'id': id,
      'clientId': 1,
      'clientName': owner,
      'brand': 'Nissan',
      'model': 'Versa',
      'year': 2020,
      'licensePlate': plate,
      'vin': null,
      'currentMileage': 45000,
      'active': active,
      'createdAt': '2026-10-12T10:00:00.000Z',
      'updatedAt': '2026-10-12T10:00:00.000Z',
    };

FakeResponse pagina(List<Map<String, dynamic>> items) => FakeResponse(200, {
      'data': items,
      'meta': {'page': 1, 'pageSize': 10, 'total': items.length},
    });

Future<void> abrirVehiculos(
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
  await tester.tap(find.text('Vehículos').first);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('lista los vehículos con placa, propietario y estado', (tester) async {
    await abrirVehiculos(
      tester,
      role: 'RECEPTIONIST',
      handler: (request) {
        if (request.url.path.endsWith('/vehicles')) {
          return pagina([vehicleJson(1, 'ABC1234'), vehicleJson(2, 'XYZ9876', active: false, owner: 'Luis Gómez')]);
        }
        return listaVacia();
      },
    );

    expect(find.text('ABC1234'), findsOneWidget);
    expect(find.text('XYZ9876'), findsOneWidget);
    expect(find.text('Luis Gómez'), findsOneWidget);
    expect(find.text('Inactivo'), findsOneWidget);
    expect(find.text('Registrar vehículo'), findsOneWidget);
  });

  testWidgets('el mecánico consulta vehículos sin botones de alta ni de baja', (tester) async {
    await abrirVehiculos(
      tester,
      role: 'MECHANIC',
      handler: (request) =>
          request.url.path.endsWith('/vehicles') ? pagina([vehicleJson(1, 'ABC1234')]) : listaVacia(),
    );

    expect(find.text('ABC1234'), findsOneWidget);
    expect(find.text('Registrar vehículo'), findsNothing);
    expect(find.byTooltip('Desactivar vehículo'), findsNothing);
  });

  testWidgets('muestra un estado vacío cuando no hay vehículos', (tester) async {
    await abrirVehiculos(
      tester,
      role: 'RECEPTIONIST',
      handler: (request) => request.url.path.endsWith('/vehicles') ? pagina([]) : listaVacia(),
    );

    expect(find.text('Todavía no hay vehículos en esta lista.'), findsOneWidget);
  });

  testWidgets('desactivar un vehículo pide confirmación antes de llamar al servidor', (tester) async {
    final log = <http.Request>[];
    await abrirVehiculos(
      tester,
      role: 'RECEPTIONIST',
      log: log,
      handler: (request) {
        if (request.method == 'PATCH') {
          return FakeResponse(200, {'data': vehicleJson(1, 'ABC1234', active: false)});
        }
        return request.url.path.endsWith('/vehicles') ? pagina([vehicleJson(1, 'ABC1234')]) : listaVacia();
      },
    );

    await tester.tap(find.byTooltip('Desactivar vehículo'));
    await tester.pumpAndSettle();
    expect(find.text('¿Seguro que quieres desactivar el vehículo ABC1234?'), findsOneWidget);

    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(log.where((r) => r.method == 'PATCH'), isEmpty, reason: 'al cancelar no se debe llamar al servidor');

    await tester.tap(find.byTooltip('Desactivar vehículo'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();
    expect(log.where((r) => r.method == 'PATCH' && r.url.path.endsWith('/vehicles/1/status')), hasLength(1));
    expect(find.text('Vehículo desactivado.'), findsOneWidget);
  });

  testWidgets('el formulario exige propietario, marca, modelo, año y placa', (tester) async {
    await abrirVehiculos(
      tester,
      role: 'RECEPTIONIST',
      handler: (request) =>
          request.url.path.endsWith('/vehicles') ? pagina([vehicleJson(1, 'ABC1234')]) : listaVacia(),
    );

    await tester.tap(find.text('Registrar vehículo'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Guardar vehículo'));
    await tester.pump();

    expect(find.text('Elige al propietario del vehículo.'), findsOneWidget);
    expect(find.text('La marca es obligatoria.'), findsOneWidget);
    expect(find.text('El modelo es obligatorio.'), findsOneWidget);
    expect(find.textContaining('Ingresa un año entre 1950'), findsOneWidget);
    expect(find.text('La placa es obligatoria.'), findsOneWidget);
  });
}
