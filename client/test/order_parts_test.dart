import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/providers/auth_provider.dart';
import 'package:motorix_client/providers/orders_provider.dart';
import 'package:motorix_client/providers/payments_provider.dart';
import 'package:motorix_client/providers/parts_provider.dart';
import 'package:motorix_client/screens/order_detail_screen.dart';
import 'package:motorix_client/utils/app_theme.dart';
import 'package:provider/provider.dart';

import 'helpers/fake_api.dart';
import 'inventory_screen_test.dart' show parteJson;
import 'order_status_actions_test.dart' show orden;

Map<String, dynamic> lineaJson({int id = 11, int cantidad = 2}) => {
      'id': id,
      'partId': 1,
      'code': 'BUJ-100',
      'name': 'Bujía de iridio',
      'quantity': cantidad,
      'unitPrice': 80.0,
      'subtotal': cantidad * 80.0,
    };

Map<String, dynamic> ordenConPartes(List<Map<String, dynamic>> lineas, {String estado = 'EN_REPARACION'}) {
  final total = lineas.fold<double>(0, (suma, l) => suma + (l['subtotal'] as double));
  return {...orden(estado: estado), 'parts': lineas, 'partsTotal': total, 'total': total};
}

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
        ChangeNotifierProvider(create: (_) => PartsProvider(api)),
      ],
      child: MaterialApp(theme: buildAppTheme(useGoogleFonts: false), home: const OrderDetailScreen(orderId: 3)),
    ),
  );
  await tester.pumpAndSettle();
  return log;
}

FakeResponse catalogo() => FakeResponse(200, {
      'data': [
        parteJson(1, 'BUJ-100', stock: 5),
        parteJson(2, 'BAL-300', nombre: 'Balatas', stock: 0, nivel: 'AGOTADO'),
      ],
      'meta': {'page': 1, 'pageSize': 20, 'total': 2},
    });

FakeHandler servidor(Map<String, dynamic> detalle, {FakeResponse Function(http.Request)? ante}) => (request) {
      final path = request.url.path;
      if (path.endsWith('/parts') && request.method == 'GET') {
        return catalogo();
      }
      if (path.contains('/orders/3/parts') && ante != null) {
        return ante(request);
      }
      return FakeResponse(200, {'data': detalle});
    };

Iterable<http.Request> cambiosDePartes(List<http.Request> log, String metodo) =>
    log.where((r) => r.method == metodo && r.url.path.contains('/orders/3/parts'));

Future<void> elegirYAgregar(WidgetTester tester, String cantidad) async {
  await tester.tap(find.text('Agregar refacción'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('BUJ-100 · Bujía de iridio'));
  await tester.pumpAndSettle();
  await tester.enterText(find.widgetWithText(TextFormField, 'Cantidad'), cantidad);
}

void main() {
  testWidgets('el mecánico asignado agrega una refacción y el total se actualiza', (tester) async {
    final log = await abrirDetalle(
      tester,
      role: 'MECHANIC',
      handler: servidor(ordenConPartes([]), ante: (request) {
        return FakeResponse(201, {
          'data': ordenConPartes([lineaJson(cantidad: 2)]),
        });
      }),
    );

    expect(find.text('Todavía no hay refacciones registradas.'), findsOneWidget);
    await elegirYAgregar(tester, '2');
    await tester.tap(find.widgetWithText(FilledButton, 'Agregar'));
    await tester.pumpAndSettle();

    expect(jsonDecode(cambiosDePartes(log, 'POST').single.body), {'partId': 1, 'quantity': 2});
    expect(find.text('Se agregó «Bujía de iridio» a la orden.'), findsOneWidget);
    expect(find.text('2 × Bujía de iridio (BUJ-100)'), findsOneWidget);
    expect(find.text('Total: \$160.00'), findsOneWidget);
  });

  testWidgets('no deja pedir más unidades de las disponibles y marca las agotadas', (tester) async {
    final log = await abrirDetalle(tester, role: 'MECHANIC', handler: servidor(ordenConPartes([])));

    await tester.tap(find.text('Agregar refacción'));
    await tester.pumpAndSettle();
    expect(find.text('Agotada'), findsOneWidget);
    await tester.tap(find.text('BUJ-100 · Bujía de iridio'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Cantidad'), '9');
    await tester.tap(find.widgetWithText(FilledButton, 'Agregar'));
    await tester.pumpAndSettle();

    expect(find.text('Solo hay 5 unidades disponibles.'), findsOneWidget);
    expect(cambiosDePartes(log, 'POST'), isEmpty);
  });

  testWidgets('exige elegir una refacción antes de agregar', (tester) async {
    final log = await abrirDetalle(tester, role: 'MECHANIC', handler: servidor(ordenConPartes([])));

    await tester.tap(find.text('Agregar refacción'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Cantidad'), '1');
    await tester.tap(find.widgetWithText(FilledButton, 'Agregar'));
    await tester.pumpAndSettle();

    expect(find.text('Elige la refacción que se usó.'), findsOneWidget);
    expect(cambiosDePartes(log, 'POST'), isEmpty);
  });

  testWidgets('el error de stock insuficiente del servidor se muestra al usuario', (tester) async {
    await abrirDetalle(
      tester,
      role: 'MECHANIC',
      handler: servidor(ordenConPartes([]), ante: (_) {
        return apiError(409, 'INSUFFICIENT_STOCK', 'No hay existencia suficiente de «Bujía de iridio»: disponible 1 unidad.');
      }),
    );

    await elegirYAgregar(tester, '2');
    await tester.tap(find.widgetWithText(FilledButton, 'Agregar'));
    await tester.pumpAndSettle();

    expect(find.textContaining('No hay existencia suficiente'), findsOneWidget);
    expect(find.text('Todavía no hay refacciones registradas.'), findsOneWidget);
  });

  testWidgets('cambiar la cantidad envía la nueva cantidad', (tester) async {
    final log = await abrirDetalle(
      tester,
      role: 'MECHANIC',
      handler: servidor(ordenConPartes([lineaJson()]), ante: (_) {
        return FakeResponse(200, {
          'data': ordenConPartes([lineaJson(cantidad: 4)]),
        });
      }),
    );

    await tester.tap(find.byTooltip('Cambiar cantidad de Bujía de iridio'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Cantidad'), '4');
    await tester.tap(find.text('Guardar cantidad'));
    await tester.pumpAndSettle();

    final peticion = cambiosDePartes(log, 'PUT').single;
    expect(peticion.url.path, endsWith('/orders/3/parts/11'));
    expect(jsonDecode(peticion.body), {'quantity': 4});
    expect(find.text('4 × Bujía de iridio (BUJ-100)'), findsOneWidget);
  });

  testWidgets('quitar la refacción pide confirmación y no llama al servidor si se cancela', (tester) async {
    final log = await abrirDetalle(
      tester,
      role: 'MECHANIC',
      handler: servidor(ordenConPartes([lineaJson()]), ante: (_) => FakeResponse(200, {'data': ordenConPartes([])})),
    );

    await tester.tap(find.byTooltip('Quitar Bujía de iridio'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Las 2 unidades regresarán al inventario'), findsOneWidget);
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(cambiosDePartes(log, 'DELETE'), isEmpty);

    await tester.tap(find.byTooltip('Quitar Bujía de iridio'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();
    expect(cambiosDePartes(log, 'DELETE').single.url.path, endsWith('/orders/3/parts/11'));
    expect(find.text('Se quitó «Bujía de iridio» de la orden.'), findsOneWidget);
    expect(find.text('Todavía no hay refacciones registradas.'), findsOneWidget);
  });

  testWidgets('recepción ve las refacciones pero no puede modificarlas', (tester) async {
    await abrirDetalle(tester, role: 'RECEPTIONIST', handler: servidor(ordenConPartes([lineaJson()])));

    expect(find.text('2 × Bujía de iridio (BUJ-100)'), findsOneWidget);
    expect(find.text('Agregar refacción'), findsNothing);
    expect(find.byTooltip('Quitar Bujía de iridio'), findsNothing);
  });

  testWidgets('en una orden terminada el mecánico no puede modificar refacciones', (tester) async {
    await abrirDetalle(tester, role: 'MECHANIC', handler: servidor(ordenConPartes([lineaJson()], estado: 'TERMINADO')));

    expect(find.text('2 × Bujía de iridio (BUJ-100)'), findsOneWidget);
    expect(find.text('Agregar refacción'), findsNothing);
  });

  testWidgets('en una orden terminada el administrador debe indicar el motivo', (tester) async {
    final log = await abrirDetalle(
      tester,
      role: 'ADMIN',
      handler: servidor(ordenConPartes([lineaJson()], estado: 'TERMINADO'), ante: (_) {
        return FakeResponse(201, {'data': ordenConPartes([lineaJson(), lineaJson(id: 12)], estado: 'TERMINADO')});
      }),
    );

    await elegirYAgregar(tester, '1');
    await tester.tap(find.widgetWithText(FilledButton, 'Agregar'));
    await tester.pumpAndSettle();
    expect(find.text('Indica el motivo del cambio.'), findsOneWidget);
    expect(cambiosDePartes(log, 'POST'), isEmpty);

    await tester.enterText(
      find.widgetWithText(TextFormField, 'Motivo del cambio (obligatorio en órdenes terminadas)'),
      'Faltó registrarla',
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Agregar'));
    await tester.pumpAndSettle();
    expect(jsonDecode(cambiosDePartes(log, 'POST').single.body), {'partId': 1, 'quantity': 1, 'reason': 'Faltó registrarla'});
  });

  testWidgets('quitar una refacción de una orden terminada pide el motivo y lo envía', (tester) async {
    final log = await abrirDetalle(
      tester,
      role: 'ADMIN',
      handler: servidor(ordenConPartes([lineaJson()], estado: 'TERMINADO'), ante: (_) {
        return FakeResponse(200, {'data': ordenConPartes([], estado: 'TERMINADO')});
      }),
    );

    await tester.tap(find.byTooltip('Quitar Bujía de iridio'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar'));
    await tester.pump();
    expect(find.text('Indica el motivo del cambio.'), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextFormField, 'Motivo del cambio'), 'Error de captura');
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();
    expect(jsonDecode(cambiosDePartes(log, 'DELETE').single.body), {'reason': 'Error de captura'});
  });

  testWidgets('una orden cancelada muestra las refacciones como registro devuelto al inventario', (tester) async {
    await abrirDetalle(tester, role: 'ADMIN', handler: servidor(ordenConPartes([lineaJson()], estado: 'CANCELADA')));

    expect(find.text('Orden cancelada: estas refacciones regresaron al inventario.'), findsOneWidget);
    expect(find.text('Agregar refacción'), findsNothing);
  });
}
