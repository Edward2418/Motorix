import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

import 'helpers/fake_api.dart';
import 'inventory_screen_test.dart' show abrirInventario, conPartes, parteJson;

FakeResponse _bajoElCosto() => apiError(
      422,
      'PRICE_BELOW_COST',
      'El precio de venta es menor al de compra. Confirma para guardarlo.',
      details: [
        {'field': 'salePrice', 'message': 'El precio de venta es menor al de compra.'},
      ],
    );

Future<void> _llenarFormulario(WidgetTester tester, {required String compra, required String venta}) async {
  await tester.tap(find.text('Registrar refacción'));
  await tester.pumpAndSettle();
  await tester.enterText(find.widgetWithText(TextFormField, 'Código'), 'BUJ-200');
  await tester.enterText(find.widgetWithText(TextFormField, 'Nombre'), 'Bujía de platino');
  await tester.enterText(find.widgetWithText(TextFormField, 'Categoría'), 'Motor');
  await tester.enterText(find.widgetWithText(TextFormField, 'Marca'), 'NGK');
  await tester.enterText(find.widgetWithText(TextFormField, 'Stock mínimo'), '4');
  await tester.enterText(find.widgetWithText(TextFormField, 'Precio de compra'), compra);
  await tester.enterText(find.widgetWithText(TextFormField, 'Precio de venta'), venta);
  await tester.tap(find.text('Guardar refacción'));
  await tester.pumpAndSettle();
}

Finder _enElDialogo(String texto) => find.descendant(of: find.byType(AlertDialog), matching: find.text(texto));

bool _esAltaDeParte(http.Request r) => r.method == 'POST' && r.url.path.endsWith('/parts');

void main() {
  FakeHandler servidor() => (request) {
        if (_esAltaDeParte(request)) {
          final cuerpo = jsonDecode(request.body) as Map<String, dynamic>;
          if (cuerpo['confirmBelowCost'] == true) {
            return FakeResponse(201, {'data': parteJson(2, 'BUJ-200')});
          }
          return _bajoElCosto();
        }
        return conPartes([parteJson(1, 'BUJ-100')])(request);
      };

  testWidgets('un precio de venta menor al de compra pide confirmación y, al confirmar, reenvía con confirmBelowCost', (tester) async {
    final log = <http.Request>[];
    await abrirInventario(tester, role: 'ADMIN', handler: servidor(), log: log);

    await _llenarFormulario(tester, compra: '100', venta: '80');

    expect(find.text('Precio de venta menor al de compra'), findsOneWidget);
    await tester.tap(_enElDialogo('Confirmar'));
    await tester.pumpAndSettle();

    final altas = log.where(_esAltaDeParte).toList();
    expect(altas, hasLength(2));
    expect(jsonDecode(altas[0].body) as Map<String, dynamic>, isNot(contains('confirmBelowCost')));
    expect((jsonDecode(altas[1].body) as Map<String, dynamic>)['confirmBelowCost'], isTrue);
    // La refacción se guardó y el formulario se cerró.
    expect(find.text('Guardar refacción'), findsNothing);
  });

  testWidgets('si se cancela la confirmación no se guarda: el formulario sigue abierto con el aviso en el precio de venta', (tester) async {
    final log = <http.Request>[];
    await abrirInventario(tester, role: 'ADMIN', handler: servidor(), log: log);

    await _llenarFormulario(tester, compra: '100', venta: '80');
    expect(find.text('Precio de venta menor al de compra'), findsOneWidget);
    await tester.tap(_enElDialogo('Cancelar'));
    await tester.pumpAndSettle();

    expect(log.where(_esAltaDeParte), hasLength(1));
    expect(find.text('Guardar refacción'), findsOneWidget);
    expect(find.text('El precio de venta es menor al de compra.'), findsOneWidget);
  });

  testWidgets('un precio de venta igual o mayor al de compra se guarda sin pedir confirmación', (tester) async {
    final log = <http.Request>[];
    await abrirInventario(
      tester,
      role: 'ADMIN',
      handler: (request) {
        if (_esAltaDeParte(request)) {
          return FakeResponse(201, {'data': parteJson(2, 'BUJ-200')});
        }
        return conPartes([parteJson(1, 'BUJ-100')])(request);
      },
      log: log,
    );

    await _llenarFormulario(tester, compra: '80', venta: '100');

    expect(find.byType(AlertDialog), findsNothing);
    final altas = log.where(_esAltaDeParte).toList();
    expect(altas, hasLength(1));
    expect(jsonDecode(altas.single.body) as Map<String, dynamic>, isNot(contains('confirmBelowCost')));
  });
}
