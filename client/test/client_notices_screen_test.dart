import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Map<String, dynamic> pendiente(
  String reason,
  String factKey,
  String cliente, {
  String telefono = '5551234567',
  String vehiculo = 'ABC1234 · Nissan Versa 2020',
  String detalle = 'Orden OS-2026-0010 terminada sin entregar',
}) =>
    {
      'reason': reason,
      'factKey': factKey,
      'clientId': 1,
      'clientName': cliente,
      'phone': telefono,
      'vehicleLabel': vehiculo,
      'detail': detalle,
      'date': '2026-11-19T16:00:00.000Z',
    };

FakeResponse paginaAvisos(List<Map<String, dynamic>> items) => FakeResponse(200, {
      'data': items,
      'meta': {'total': items.length},
    });

FakeResponse avisoRegistrado() => FakeResponse(201, {
      'data': {
        'id': 1,
        'reason': 'ORDEN_TERMINADA',
        'factKey': 'ORDER:10',
        'clientId': 1,
        'note': null,
        'notifiedBy': 1,
        'notifiedByName': 'Recepción',
        'notifiedAt': '2026-11-19T16:30:00.000Z',
      },
    });

FakeResponse contador() => FakeResponse(200, {
      'data': {'unread': 0},
    });

Future<List<http.Request>> abrirAvisos(
  WidgetTester tester, {
  required String role,
  required FakeHandler handler,
  bool abrirPantalla = true,
  Future<void>? Function(http.Request request)? hold,
}) async {
  tester.view.physicalSize = const Size(2000, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final log = <http.Request>[];
  final api = fakeApi((request) {
    if (request.url.path.endsWith('/auth/login')) {
      return loginOk(role: role);
    }
    if (request.url.path.endsWith('/notifications/count')) {
      return contador();
    }
    return handler(request);
  }, log: log, hold: hold);
  await tester.pumpWidget(MotorixApp(api: api, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.widgetWithText(TextFormField, 'Usuario o correo electrónico'), 'usuario');
  await tester.enterText(find.widgetWithText(TextFormField, 'Contraseña'), 'Clave2026');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
  if (abrirPantalla) {
    await tester.tap(find.text('Clientes por avisar').first);
    await tester.pumpAndSettle();
  }
  return log;
}

FakeHandler conAvisos(List<Map<String, dynamic>> items) =>
    (request) => request.url.path.endsWith('/client-notices') ? paginaAvisos(items) : listaVacia();

void main() {
  testWidgets('lista a los clientes con nombre, teléfono, vehículo y motivo', (tester) async {
    await abrirAvisos(
      tester,
      role: 'RECEPTIONIST',
      handler: conAvisos([
        pendiente('ORDEN_TERMINADA', 'ORDER:10', 'Ana Pérez'),
        pendiente('CITA_MANANA', 'APPT:7', 'Luis Gómez', telefono: '5559876543', vehiculo: 'XYZ9876 · Honda Civic 2019', detalle: 'Cita mañana a las 10:00'),
      ]),
    );

    expect(find.text('Ana Pérez'), findsOneWidget);
    expect(find.text('5551234567'), findsOneWidget);
    expect(find.text('ABC1234 · Nissan Versa 2020'), findsOneWidget);
    expect(find.text('Orden terminada'), findsOneWidget);
    expect(find.text('Luis Gómez'), findsOneWidget);
    expect(find.text('Cita de mañana'), findsOneWidget);
    expect(find.text('Marcar como avisado'), findsNWidgets(2));
  });

  testWidgets('marcar como avisado pide una nota opcional, registra el aviso, saca al cliente y confirma', (tester) async {
    final log = await abrirAvisos(
      tester,
      role: 'RECEPTIONIST',
      handler: (request) {
        if (request.method == 'POST' && request.url.path.endsWith('/client-notices')) {
          return avisoRegistrado();
        }
        return conAvisos([pendiente('ORDEN_TERMINADA', 'ORDER:10', 'Ana Pérez')])(request);
      },
    );

    await tester.tap(find.text('Marcar como avisado'));
    await tester.pumpAndSettle();
    expect(find.text('Nota (opcional)'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'No contestó');
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();

    final envios = log.where((r) => r.method == 'POST' && r.url.path.endsWith('/client-notices')).toList();
    expect(envios, hasLength(1));
    expect(envios.single.body, contains('ORDER:10'));
    expect(envios.single.body, contains('ORDEN_TERMINADA'));
    expect(envios.single.body, contains('No contestó'));
    expect(find.text('Ana Pérez'), findsNothing);
    expect(find.text('No hay clientes por avisar.'), findsOneWidget);
    expect(find.text('Aviso registrado: Ana Pérez.'), findsOneWidget);
  });

  testWidgets('sin escribir nota también se registra, sin enviar el campo note', (tester) async {
    final log = await abrirAvisos(
      tester,
      role: 'ADMIN',
      handler: (request) => request.method == 'POST'
          ? avisoRegistrado()
          : conAvisos([pendiente('ORDEN_TERMINADA', 'ORDER:10', 'Ana Pérez')])(request),
    );

    await tester.tap(find.text('Marcar como avisado'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();

    final envio = log.singleWhere((r) => r.method == 'POST' && r.url.path.endsWith('/client-notices'));
    expect(envio.body, isNot(contains('"note"')));
  });

  testWidgets('cancelar el diálogo no registra nada y deja al cliente en la lista', (tester) async {
    final log = await abrirAvisos(
      tester,
      role: 'RECEPTIONIST',
      handler: conAvisos([pendiente('ORDEN_TERMINADA', 'ORDER:10', 'Ana Pérez')]),
    );

    await tester.tap(find.text('Marcar como avisado'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();

    expect(log.where((r) => r.method == 'POST' && r.url.path.endsWith('/client-notices')), isEmpty);
    expect(find.text('Ana Pérez'), findsOneWidget);
  });

  testWidgets('si el hecho ya se avisó (409) muestra el mensaje del servidor y vuelve a consultar la lista', (tester) async {
    var consultas = 0;
    final log = await abrirAvisos(
      tester,
      role: 'RECEPTIONIST',
      handler: (request) {
        if (request.method == 'POST') {
          return apiError(409, 'NOTICE_ALREADY_REGISTERED', 'Ese hecho ya se avisó al cliente.');
        }
        // Solo cuentan las consultas de esta pantalla (la pantalla de inicio hace las suyas).
        if (!request.url.path.endsWith('/client-notices')) {
          return listaVacia();
        }
        consultas++;
        return consultas == 1 ? paginaAvisos([pendiente('ORDEN_TERMINADA', 'ORDER:10', 'Ana Pérez')]) : paginaAvisos([]);
      },
    );

    await tester.tap(find.text('Marcar como avisado'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();

    expect(find.text('Ese hecho ya se avisó al cliente.'), findsOneWidget);
    expect(log.where((r) => r.method == 'GET' && r.url.path.endsWith('/client-notices')), hasLength(2));
    expect(find.text('Ana Pérez'), findsNothing);
  });

  testWidgets('sin pendientes muestra el estado vacío', (tester) async {
    await abrirAvisos(tester, role: 'RECEPTIONIST', handler: conAvisos([]));
    expect(find.text('No hay clientes por avisar.'), findsOneWidget);
  });

  testWidgets('mientras consulta muestra un indicador de carga', (tester) async {
    // La lista espera a que se libere la compuerta, para ver el estado de carga.
    final compuerta = Completer<void>();
    await abrirAvisos(
      tester,
      role: 'RECEPTIONIST',
      handler: conAvisos([]),
      abrirPantalla: false,
      hold: (request) => request.url.path.endsWith('/client-notices') ? compuerta.future : null,
    );
    await tester.tap(find.text('Clientes por avisar').first);
    // La pantalla pide la lista en un callback posterior al primer cuadro: el indicador aparece en el segundo.
    await tester.pump();
    await tester.pump();
    expect(find.byType(CircularProgressIndicator), findsWidgets);
    compuerta.complete();
    await tester.pumpAndSettle();
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });

  testWidgets('si la consulta falla muestra el error con la opción de reintentar', (tester) async {
    var intentos = 0;
    await abrirAvisos(
      tester,
      role: 'RECEPTIONIST',
      handler: (request) {
        // Solo cuentan las consultas de esta pantalla (la pantalla de inicio hace las suyas).
        if (!request.url.path.endsWith('/client-notices')) {
          return listaVacia();
        }
        intentos++;
        return intentos == 1
            ? apiError(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado.')
            : paginaAvisos([pendiente('ORDEN_TERMINADA', 'ORDER:10', 'Ana Pérez')]);
      },
    );
    expect(find.text('Ocurrió un error inesperado.'), findsOneWidget);

    await tester.tap(find.text('Reintentar'));
    await tester.pumpAndSettle();

    expect(find.text('Ana Pérez'), findsOneWidget);
  });

  group('menú lateral', () {
    for (final rol in ['ADMIN', 'RECEPTIONIST']) {
      testWidgets('$rol ve «Clientes por avisar»', (tester) async {
        await abrirAvisos(tester, role: rol, handler: conAvisos([]), abrirPantalla: false);
        expect(find.text('Clientes por avisar'), findsWidgets);
      });
    }

    testWidgets('el mecánico no ve «Clientes por avisar»', (tester) async {
      await abrirAvisos(tester, role: 'MECHANIC', handler: conAvisos([]), abrirPantalla: false);
      expect(find.text('Clientes por avisar'), findsNothing);
    });
  });
}
