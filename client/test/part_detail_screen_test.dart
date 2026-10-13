import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/providers/auth_provider.dart';
import 'package:motorix_client/providers/parts_provider.dart';
import 'package:motorix_client/screens/part_detail_screen.dart';
import 'package:motorix_client/utils/app_theme.dart';
import 'package:provider/provider.dart';

import 'helpers/fake_api.dart';
import 'inventory_screen_test.dart' show parteJson;

Map<String, dynamic> movimientoJson(
  int id,
  String tipo,
  int cantidad,
  int stockDespues,
  String motivo, {
  String? folio,
}) =>
    {
      'id': id,
      'partId': 1,
      'type': tipo,
      'quantity': cantidad,
      'stockAfter': stockDespues,
      'reason': motivo,
      'orderId': folio == null ? null : 5,
      'orderFolio': folio,
      'createdByName': 'Administrador',
      'createdAt': '2026-10-13T10:00:00.000Z',
    };

/// Simula el servidor: el stock y los movimientos cambian cuando la pantalla registra un movimiento.
class ServidorDePartes {
  ServidorDePartes({this.stock = 10}) {
    movimientos = [
      movimientoJson(2, 'SALIDA', -3, stock, 'Uso en la orden OS-2026-0001', folio: 'OS-2026-0001'),
      movimientoJson(1, 'ENTRADA', stock + 3, stock + 3, 'Stock inicial'),
    ];
  }

  int stock;
  late List<Map<String, dynamic>> movimientos;
  final List<http.Request> peticiones = [];
  FakeResponse? errorAlRegistrar;

  FakeResponse responder(http.Request request) {
    peticiones.add(request);
    final path = request.url.path;
    if (path.endsWith('/auth/login')) {
      return loginOk();
    }
    if (request.method == 'POST' && path.endsWith('/movements')) {
      if (errorAlRegistrar != null) {
        return errorAlRegistrar!;
      }
      final cuerpo = jsonDecode(request.body) as Map<String, dynamic>;
      final delta = cuerpo['type'] == 'ENTRADA' ? cuerpo['quantity'] as int : (cuerpo['countedStock'] as int) - stock;
      stock += delta;
      final nuevo = movimientoJson(movimientos.length + 1, cuerpo['type'] as String, delta, stock, cuerpo['reason'] as String);
      movimientos.insert(0, nuevo);
      return FakeResponse(201, {'data': nuevo});
    }
    if (path.endsWith('/movements')) {
      return FakeResponse(200, {
        'data': movimientos,
        'meta': {'page': 1, 'pageSize': 10, 'total': movimientos.length},
      });
    }
    if (path.endsWith('/parts/1')) {
      return FakeResponse(200, {'data': parteJson(1, 'BUJ-100', stock: stock)});
    }
    return listaVacia();
  }

  Iterable<http.Request> get registros => peticiones.where((r) => r.method == 'POST' && r.url.path.endsWith('/movements'));
}

Future<void> abrirDetalle(WidgetTester tester, ServidorDePartes servidor) async {
  tester.view.physicalSize = const Size(2000, 1200);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  final api = fakeApi(servidor.responder);
  final auth = AuthProvider(api);
  await auth.login('usuario', 'Clave2026');
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthProvider>.value(value: auth),
        ChangeNotifierProvider(create: (_) => PartsProvider(api)),
      ],
      child: MaterialApp(theme: buildAppTheme(useGoogleFonts: false), home: const PartDetailScreen(partId: 1)),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('muestra los datos de la refacción y la lista de movimientos', (tester) async {
    await abrirDetalle(tester, ServidorDePartes());

    expect(find.text('BUJ-100 · Bujía de iridio'), findsOneWidget);
    expect(find.text('Movimientos de inventario'), findsOneWidget);
    expect(find.text('Stock inicial'), findsOneWidget);
    expect(find.text('Uso en la orden OS-2026-0001'), findsOneWidget);
    expect(find.text('OS-2026-0001'), findsOneWidget);
    expect(find.text('-3'), findsOneWidget);
    expect(find.text('+13'), findsOneWidget);
    expect(find.text('Entrada'), findsOneWidget);
    expect(find.text('Salida'), findsOneWidget);
  });

  testWidgets('la entrada exige cantidad y motivo y actualiza el stock mostrado', (tester) async {
    final servidor = ServidorDePartes(stock: 10);
    await abrirDetalle(tester, servidor);

    await tester.tap(find.text('Registrar entrada'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Registrar entrada').last);
    await tester.pump();
    expect(find.text('Indica la cantidad.'), findsOneWidget);
    expect(find.text('Indica el motivo.'), findsOneWidget);
    expect(servidor.registros, isEmpty);

    await tester.enterText(find.widgetWithText(TextFormField, 'Cantidad que entra'), '5');
    await tester.enterText(find.widgetWithText(TextFormField, 'Motivo de la entrada'), 'Compra al proveedor');
    await tester.tap(find.widgetWithText(FilledButton, 'Registrar entrada').last);
    await tester.pumpAndSettle();

    expect(jsonDecode(servidor.registros.single.body), {'type': 'ENTRADA', 'quantity': 5, 'reason': 'Compra al proveedor'});
    expect(find.text('Entrada registrada.'), findsOneWidget);
    expect(find.text('Compra al proveedor'), findsOneWidget);
    expect(find.text('15'), findsWidgets, reason: 'el stock actual pasa de 10 a 15');
  });

  testWidgets('el ajuste muestra la diferencia, pide confirmación y envía el stock contado', (tester) async {
    final servidor = ServidorDePartes(stock: 10);
    await abrirDetalle(tester, servidor);

    await tester.tap(find.text('Ajustar inventario'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Stock contado'), '7');
    await tester.pump();
    expect(find.text('Diferencia: -3'), findsOneWidget);
    await tester.enterText(find.widgetWithText(TextFormField, 'Motivo del ajuste'), 'Conteo físico');
    await tester.tap(find.widgetWithText(FilledButton, 'Ajustar'));
    await tester.pumpAndSettle();

    expect(find.textContaining('cambiará de 10 a 7 (-3)'), findsOneWidget);
    expect(servidor.registros, isEmpty, reason: 'sin confirmar no se envía nada');
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();

    expect(jsonDecode(servidor.registros.single.body), {'type': 'AJUSTE', 'countedStock': 7, 'reason': 'Conteo físico'});
    expect(find.text('Inventario ajustado.'), findsOneWidget);
  });

  testWidgets('cancelar la confirmación del ajuste no llama al servidor', (tester) async {
    final servidor = ServidorDePartes(stock: 10);
    await abrirDetalle(tester, servidor);

    await tester.tap(find.text('Ajustar inventario'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Stock contado'), '12');
    await tester.enterText(find.widgetWithText(TextFormField, 'Motivo del ajuste'), 'Conteo físico');
    await tester.tap(find.widgetWithText(FilledButton, 'Ajustar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancelar').last);
    await tester.pumpAndSettle();

    expect(servidor.registros, isEmpty);
  });

  testWidgets('un conteo igual al stock registrado no se puede ajustar', (tester) async {
    await abrirDetalle(tester, ServidorDePartes(stock: 10));

    await tester.tap(find.text('Ajustar inventario'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Stock contado'), '10');
    await tester.enterText(find.widgetWithText(TextFormField, 'Motivo del ajuste'), 'Conteo físico');
    await tester.tap(find.widgetWithText(FilledButton, 'Ajustar'));
    await tester.pump();

    expect(find.textContaining('no hay nada que ajustar'), findsOneWidget);
  });

  testWidgets('el error del servidor al registrar se muestra y no cambia el stock', (tester) async {
    final servidor = ServidorDePartes(stock: 10)
      ..errorAlRegistrar = apiError(400, 'VALIDATION_ERROR', 'El stock no puede superar 99999999 unidades.');
    await abrirDetalle(tester, servidor);

    await tester.tap(find.text('Registrar entrada'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Cantidad que entra'), '5');
    await tester.enterText(find.widgetWithText(TextFormField, 'Motivo de la entrada'), 'Compra');
    await tester.tap(find.widgetWithText(FilledButton, 'Registrar entrada').last);
    await tester.pumpAndSettle();

    expect(find.text('El stock no puede superar 99999999 unidades.'), findsOneWidget);
    expect(servidor.stock, 10);
  });
}
