import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Map<String, dynamic> cliente({bool active = true, int vehiculos = 0}) => {
      'id': 1,
      'name': 'Ana Pérez',
      'phone': '55 1234 0001',
      'email': 'ana@correo.com',
      'active': active,
      'vehicleCount': vehiculos,
      'createdAt': '2026-10-12T10:00:00.000Z',
      'updatedAt': '2026-10-12T10:00:00.000Z',
      'vehicles': <Object>[],
    };

FakeResponse lista(Map<String, dynamic> client) => FakeResponse(200, {
      'data': [client],
      'meta': {'page': 1, 'pageSize': 10, 'total': 1},
    });

Future<void> abrirDetalle(
  WidgetTester tester, {
  required FakeHandler handler,
  List<http.Request>? log,
  String role = 'RECEPTIONIST',
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
  await tester.tap(find.text('Ana Pérez'));
  await tester.pumpAndSettle();
}

FakeHandler servidor({Map<String, dynamic>? detalle, FakeResponse Function(http.Request)? mutacion}) {
  return (request) {
    if (request.method == 'PUT' || request.method == 'PATCH') {
      return mutacion!(request);
    }
    if (request.url.path.endsWith('/clients/1')) {
      return FakeResponse(200, {'data': detalle ?? cliente()});
    }
    return lista(cliente());
  };
}

void main() {
  testWidgets('el formulario de edición llega precargado y valida los datos', (tester) async {
    await abrirDetalle(tester, handler: servidor());

    await tester.tap(find.text('Editar'));
    await tester.pumpAndSettle();

    expect(find.text('Editar cliente'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Ana Pérez'), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextFormField, 'Ana Pérez'), '');
    await tester.tap(find.text('Guardar cambios'));
    await tester.pump();
    expect(find.text('El nombre es obligatorio.'), findsOneWidget);
  });

  testWidgets('guardar la edición envía los datos al servidor y confirma el éxito', (tester) async {
    final log = <http.Request>[];
    await abrirDetalle(
      tester,
      log: log,
      handler: servidor(mutacion: (_) => FakeResponse(200, {'data': cliente()})),
    );

    await tester.tap(find.text('Editar'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Ana Pérez'), 'Ana Pérez Gómez');
    await tester.tap(find.text('Guardar cambios'));
    await tester.pumpAndSettle();

    final put = log.where((r) => r.method == 'PUT').single;
    expect(put.url.path, endsWith('/clients/1'));
    expect(put.body, contains('Ana Pérez Gómez'));
    expect(find.text('Cliente actualizado correctamente.'), findsOneWidget);
  });

  testWidgets('salir del formulario con cambios sin guardar pide confirmación', (tester) async {
    await abrirDetalle(tester, handler: servidor());

    await tester.tap(find.text('Editar'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Ana Pérez'), 'Otro nombre');
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Los cambios sin guardar se perderán.'), findsOneWidget);
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();
    expect(find.text('Editar cliente'), findsNothing);
  });

  testWidgets('desactivar al cliente pide confirmación y no llama al servidor si se cancela', (tester) async {
    final log = <http.Request>[];
    await abrirDetalle(
      tester,
      log: log,
      handler: servidor(mutacion: (_) => FakeResponse(200, {'data': cliente(active: false)})),
    );

    await tester.tap(find.text('Desactivar'));
    await tester.pumpAndSettle();
    expect(find.text('¿Seguro que quieres desactivar al cliente Ana Pérez?'), findsOneWidget);

    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(log.where((r) => r.method == 'PATCH'), isEmpty);

    await tester.tap(find.text('Desactivar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();
    expect(log.where((r) => r.method == 'PATCH' && r.url.path.endsWith('/clients/1/status')), hasLength(1));
    expect(find.text('Cliente desactivado.'), findsOneWidget);
  });

  testWidgets('muestra el mensaje del servidor cuando la baja se rechaza por vehículos activos', (tester) async {
    await abrirDetalle(
      tester,
      handler: servidor(
        detalle: cliente(vehiculos: 1),
        mutacion: (_) => apiError(
          409,
          'CONFLICT',
          'No se puede desactivar al cliente porque tiene vehículos activos. Desactiva primero sus vehículos.',
        ),
      ),
    );

    await tester.tap(find.text('Desactivar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();

    expect(find.textContaining('tiene vehículos activos'), findsOneWidget);
    expect(find.text('Desactivar'), findsOneWidget, reason: 'el cliente sigue activo');
  });

  testWidgets('el mecánico no ve las acciones de edición ni de baja', (tester) async {
    await abrirDetalle(tester, role: 'MECHANIC', handler: servidor());

    expect(find.text('Editar'), findsNothing);
    expect(find.text('Desactivar'), findsNothing);
  });
}
