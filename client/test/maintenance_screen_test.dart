import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';
import 'maintenance_dialog_test.dart' show mantenimientoJson;

Map<String, dynamic> pendiente(
  int id,
  String descripcion,
  String visual, {
  int? dias,
  int? km,
  String cliente = 'Ana Pérez',
  String telefono = '5551234567',
}) =>
    {
      ...mantenimientoJson(id: id, descripcion: descripcion, visual: visual),
      'clientName': cliente,
      'clientPhone': telefono,
      'remainingDays': dias,
      'remainingKm': km,
    };

FakeResponse paginaMantenimientos(List<Map<String, dynamic>> items) => FakeResponse(200, {
      'data': items,
      'meta': {'page': 1, 'pageSize': 10, 'total': items.length},
    });

Future<List<http.Request>> abrirMantenimientos(
  WidgetTester tester, {
  required String role,
  required FakeHandler handler,
}) async {
  tester.view.physicalSize = const Size(2000, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final log = <http.Request>[];
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
  await tester.tap(find.text('Mantenimientos').first);
  await tester.pumpAndSettle();
  return log;
}

FakeHandler conMantenimientos(List<Map<String, dynamic>> items) =>
    (request) => request.url.path.endsWith('/maintenance') ? paginaMantenimientos(items) : listaVacia();

Map<String, String> ultimaConsulta(List<http.Request> log) =>
    log.lastWhere((r) => r.method == 'GET' && r.url.path.endsWith('/maintenance')).url.queryParameters;

void main() {
  testWidgets('muestra la insignia de cada estado, el cliente con su teléfono y lo que falta', (tester) async {
    await abrirMantenimientos(
      tester,
      role: 'RECEPTIONIST',
      handler: conMantenimientos([
        pendiente(1, 'Cambio de aceite', 'VENCIDO', dias: -3, km: -200),
        pendiente(2, 'Frenos', 'PROXIMO', dias: 12, km: 800, cliente: 'Luis Gómez', telefono: '5559876543'),
        pendiente(3, 'Llantas', 'NORMAL', dias: 90),
      ]),
    );

    expect(find.text('Vencido'), findsOneWidget);
    expect(find.text('Próximo'), findsOneWidget);
    expect(find.text('Normal'), findsOneWidget);
    expect(find.text('Luis Gómez'), findsOneWidget);
    expect(find.text('5559876543'), findsOneWidget);
    expect(find.text('Hace 3 días · 200 km excedidos'), findsOneWidget);
    expect(find.text('En 12 días · 800 km restantes'), findsOneWidget);
    expect(find.text('En 90 días'), findsOneWidget);
    expect(find.text('OS-2026-0003'), findsNWidgets(3));
  });

  testWidgets('filtrar por estado visual consulta la API con ese filtro', (tester) async {
    final log = await abrirMantenimientos(
      tester,
      role: 'RECEPTIONIST',
      handler: conMantenimientos([pendiente(1, 'Cambio de aceite', 'VENCIDO', dias: -3)]),
    );
    expect(ultimaConsulta(log)['status'], 'PROGRAMADO');

    await tester.tap(find.text('Todos los estados'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Vencidos').last);
    await tester.pumpAndSettle();
    expect(ultimaConsulta(log)['visualStatus'], 'VENCIDO');
  });

  testWidgets('ver los atendidos consulta ese ciclo de vida y oculta el filtro de estado visual', (tester) async {
    final log = await abrirMantenimientos(
      tester,
      role: 'RECEPTIONIST',
      handler: conMantenimientos([mantenimientoJson(estado: 'ATENDIDO', visual: null)]),
    );

    await tester.tap(find.text('Pendientes'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Atendidos').last);
    await tester.pumpAndSettle();

    expect(ultimaConsulta(log)['status'], 'ATENDIDO');
    expect(find.text('Todos los estados'), findsNothing);
    expect(find.text('Atendido'), findsOneWidget);
  });

  testWidgets('buscar envía el texto a la API', (tester) async {
    final log = await abrirMantenimientos(tester, role: 'RECEPTIONIST', handler: conMantenimientos([]));
    await tester.enterText(find.byType(TextField).first, 'ABC');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(ultimaConsulta(log)['q'], 'ABC');
  });

  testWidgets('sin pendientes muestra un mensaje claro', (tester) async {
    await abrirMantenimientos(tester, role: 'RECEPTIONIST', handler: conMantenimientos([]));
    expect(find.text('No hay mantenimientos pendientes por avisar.'), findsOneWidget);
  });

  testWidgets('el botón del folio abre la orden de origen', (tester) async {
    final log = await abrirMantenimientos(
      tester,
      role: 'RECEPTIONIST',
      handler: (request) {
        if (request.url.path.endsWith('/maintenance')) {
          return paginaMantenimientos([pendiente(1, 'Cambio de aceite', 'PROXIMO', dias: 5)]);
        }
        if (request.url.path.endsWith('/orders/3')) {
          return FakeResponse(200, {'data': orden3()});
        }
        return listaVacia();
      },
    );

    await tester.tap(find.text('OS-2026-0003'));
    await tester.pumpAndSettle();
    expect(log.any((r) => r.url.path.endsWith('/orders/3')), isTrue);
    expect(find.text('Orden OS-2026-0003'), findsOneWidget);
  });

  for (final rol in ['ADMIN', 'RECEPTIONIST', 'MECHANIC']) {
    testWidgets('el menú del rol $rol incluye «Mantenimientos»', (tester) async {
      await abrirMantenimientos(tester, role: rol, handler: conMantenimientos([]));
      expect(find.text('Mantenimientos'), findsWidgets);
      expect(find.text('No hay mantenimientos pendientes por avisar.'), findsOneWidget);
    });
  }
}

Map<String, dynamic> orden3() => {
      'id': 3,
      'folio': 'OS-2026-0003',
      'status': 'ENTREGADO',
      'clientId': 1,
      'clientName': 'Ana Pérez',
      'vehicleId': 7,
      'vehicleLabel': 'ABC1234 · Nissan Versa 2020',
      'mechanicId': 1,
      'mechanicName': 'Mecánico Uno',
      'entryMileage': 45800,
      'total': 0,
      'createdAt': '2026-10-13T10:00:00.000Z',
      'reportedProblem': 'Ruido al frenar',
      'allowedTransitions': <Object>[],
    };
