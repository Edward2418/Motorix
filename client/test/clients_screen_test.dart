import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Map<String, dynamic> clientJson(int id, String name, {bool active = true, List<Map<String, dynamic>>? vehicles}) => {
      'id': id,
      'name': name,
      'phone': '55 1234 000$id',
      'email': null,
      'active': active,
      'vehicleCount': vehicles?.length ?? 0,
      'createdAt': '2026-10-12T10:00:00.000Z',
      'updatedAt': '2026-10-12T10:00:00.000Z',
      'vehicles': ?vehicles,
    };

FakeResponse pagina(List<Map<String, dynamic>> clientes) => FakeResponse(200, {
      'data': clientes,
      'meta': {'page': 1, 'pageSize': 10, 'total': clientes.length},
    });

Future<void> entrar(
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
}

void main() {
  testWidgets('muestra la tabla de clientes con sus datos y el botón de alta para recepción', (tester) async {
    await entrar(
      tester,
      role: 'RECEPTIONIST',
      handler: (_) => pagina([clientJson(1, 'Ana Pérez'), clientJson(2, 'Luis Gómez', active: false)]),
    );

    expect(find.text('Ana Pérez'), findsOneWidget);
    expect(find.text('Luis Gómez'), findsOneWidget);
    expect(find.text('Activo'), findsOneWidget);
    expect(find.text('Inactivo'), findsOneWidget);
    expect(find.text('Registrar cliente'), findsOneWidget);
  });

  testWidgets('el mecánico consulta clientes pero no ve el botón de registro', (tester) async {
    await entrar(tester, role: 'MECHANIC', handler: (_) => pagina([clientJson(1, 'Ana Pérez')]));

    expect(find.text('Ana Pérez'), findsOneWidget);
    expect(find.text('Registrar cliente'), findsNothing, reason: 'el mecánico solo consulta');
  });

  testWidgets('muestra un estado vacío con una acción sugerida cuando no hay clientes', (tester) async {
    await entrar(tester, role: 'RECEPTIONIST', handler: (_) => pagina([]));

    expect(find.text('Todavía no hay clientes en esta lista.'), findsOneWidget);
    expect(find.text('Registrar cliente'), findsWidgets);
  });

  testWidgets('muestra el error en español cuando el listado falla', (tester) async {
    await entrar(
      tester,
      role: 'RECEPTIONIST',
      handler: (_) => apiError(503, 'SERVICE_UNAVAILABLE', 'El servicio no está disponible por el momento.'),
    );

    expect(find.text('El servicio no está disponible por el momento.'), findsOneWidget);
    expect(find.text('Reintentar'), findsOneWidget);
  });

  testWidgets('la búsqueda consulta al servidor con el texto escrito', (tester) async {
    final log = <http.Request>[];
    await entrar(tester, role: 'RECEPTIONIST', log: log, handler: (_) => pagina([clientJson(1, 'Ana Pérez')]));

    await tester.enterText(find.byType(TextField).first, 'ana');
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();

    expect(log.last.url.queryParameters['search'], 'ana');
  });

  testWidgets('abre el detalle del cliente con sus vehículos', (tester) async {
    final vehiculo = {
      'id': 7,
      'clientId': 1,
      'clientName': 'Ana Pérez',
      'brand': 'Nissan',
      'model': 'Versa',
      'year': 2020,
      'licensePlate': 'ABC1234',
      'vin': null,
      'currentMileage': 0,
      'active': true,
      'createdAt': '2026-10-12T10:00:00.000Z',
      'updatedAt': '2026-10-12T10:00:00.000Z',
    };
    await entrar(
      tester,
      role: 'RECEPTIONIST',
      handler: (request) {
        if (request.url.path.endsWith('/clients/1')) {
          return FakeResponse(200, {
            'data': clientJson(1, 'Ana Pérez', vehicles: [vehiculo]),
          });
        }
        return pagina([clientJson(1, 'Ana Pérez')]);
      },
    );

    await tester.tap(find.text('Ana Pérez'));
    await tester.pumpAndSettle();

    expect(find.text('Vehículos'), findsWidgets);
    expect(find.text('ABC1234'), findsOneWidget);
    expect(find.text('Nissan Versa 2020'), findsOneWidget);
  });

  testWidgets('el formulario de alta valida los campos obligatorios', (tester) async {
    await entrar(tester, role: 'RECEPTIONIST', handler: (_) => pagina([clientJson(1, 'Ana Pérez')]));

    await tester.tap(find.text('Registrar cliente'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Guardar cliente'));
    await tester.pump();

    expect(find.text('El nombre es obligatorio.'), findsOneWidget);
    expect(find.text('El teléfono es obligatorio.'), findsOneWidget);
  });
}
