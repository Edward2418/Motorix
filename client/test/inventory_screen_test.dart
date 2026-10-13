import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Map<String, dynamic> parteJson(
  int id,
  String codigo, {
  String nombre = 'Bujía de iridio',
  String categoria = 'Motor',
  String marca = 'NGK',
  int stock = 20,
  int minimo = 5,
  String nivel = 'NORMAL',
  bool activa = true,
}) =>
    {
      'id': id,
      'code': codigo,
      'name': nombre,
      'category': categoria,
      'brand': marca,
      'stock': stock,
      'minStock': minimo,
      'stockLevel': nivel,
      'purchasePrice': 85.5,
      'salePrice': 129.9,
      'active': activa,
      'createdAt': '2026-10-13T10:00:00.000Z',
      'updatedAt': '2026-10-13T10:00:00.000Z',
    };

FakeResponse paginaPartes(List<Map<String, dynamic>> partes) => FakeResponse(200, {
      'data': partes,
      'meta': {'page': 1, 'pageSize': 10, 'total': partes.length},
    });

FakeHandler conPartes(List<Map<String, dynamic>> partes) => (request) {
      final path = request.url.path;
      if (path.endsWith('/parts/categories')) {
        return FakeResponse(200, {'data': ['Frenos', 'Motor']});
      }
      if (path.endsWith('/parts/alerts')) {
        return FakeResponse(200, {'data': <Object>[]});
      }
      if (path.endsWith('/parts')) {
        return paginaPartes(partes);
      }
      return listaVacia();
    };

Future<void> abrirInventario(
  WidgetTester tester, {
  required String role,
  required FakeHandler handler,
  List<http.Request>? log,
}) async {
  tester.view.physicalSize = const Size(2400, 900);
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
  if (role == 'ADMIN') {
    await tester.tap(find.text('Inventario').first);
    await tester.pumpAndSettle();
  }
}

void main() {
  testWidgets('la tabla muestra las refacciones con su nivel de stock y estado', (tester) async {
    await abrirInventario(
      tester,
      role: 'ADMIN',
      handler: conPartes([
        parteJson(1, 'BUJ-100'),
        parteJson(2, 'FIL-200', nombre: 'Filtro de aceite', stock: 2, nivel: 'BAJO'),
        parteJson(3, 'BAL-300', nombre: 'Balatas', stock: 0, nivel: 'AGOTADO', activa: false),
      ]),
    );

    expect(find.text('BUJ-100'), findsOneWidget);
    expect(find.text('Filtro de aceite'), findsOneWidget);
    expect(find.text('Normal'), findsOneWidget);
    expect(find.text('Bajo'), findsOneWidget);
    expect(find.text('Agotado'), findsOneWidget);
    expect(find.text('Inactivo'), findsOneWidget);
    expect(find.text(r'$129.90'), findsNWidgets(3));
    expect(find.text('Registrar refacción'), findsOneWidget);
  });

  testWidgets('buscar y filtrar consulta la API con los parámetros correctos', (tester) async {
    final log = <http.Request>[];
    await abrirInventario(tester, role: 'ADMIN', handler: conPartes([parteJson(1, 'BUJ-100')]), log: log);

    await tester.enterText(find.byType(TextField).first, 'buj');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    final busqueda = log.lastWhere((r) => r.method == 'GET' && r.url.path.endsWith('/parts'));
    expect(busqueda.url.queryParameters['q'], 'buj');
    expect(busqueda.url.queryParameters['active'], 'true');

    await tester.tap(find.text('Todos los niveles'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Stock bajo').last);
    await tester.pumpAndSettle();
    final filtrada = log.lastWhere((r) => r.method == 'GET' && r.url.path.endsWith('/parts'));
    expect(filtrada.url.queryParameters['stockLevel'], 'BAJO');
  });

  testWidgets('sin refacciones muestra el estado vacío con la acción de registrar', (tester) async {
    await abrirInventario(tester, role: 'ADMIN', handler: conPartes([]));
    expect(find.text('Todavía no hay refacciones registradas.'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Registrar refacción'), findsWidgets);
  });

  testWidgets('el formulario valida los campos obligatorios antes de llamar al servidor', (tester) async {
    final log = <http.Request>[];
    await abrirInventario(tester, role: 'ADMIN', handler: conPartes([parteJson(1, 'BUJ-100')]), log: log);

    await tester.tap(find.text('Registrar refacción'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Guardar refacción'));
    await tester.pumpAndSettle();

    expect(find.text('El código es obligatorio.'), findsOneWidget);
    expect(find.text('El nombre es obligatorio.'), findsOneWidget);
    expect(find.text('La categoría es obligatoria.'), findsOneWidget);
    expect(find.text('La marca es obligatoria.'), findsOneWidget);
    expect(find.text('El stock mínimo es obligatorio.'), findsOneWidget);
    expect(find.text('El precio de compra es obligatorio.'), findsOneWidget);
    expect(log.where((r) => r.method == 'POST' && r.url.path.endsWith('/parts')), isEmpty);
  });

  testWidgets('el formulario envía la refacción y muestra el error de código duplicado', (tester) async {
    final log = <http.Request>[];
    await abrirInventario(
      tester,
      role: 'ADMIN',
      handler: (request) {
        if (request.method == 'POST' && request.url.path.endsWith('/parts')) {
          return apiError(409, 'DUPLICATE_PART_CODE', 'Ya existe una refacción con ese código.',
              details: [
                {'field': 'code', 'message': 'Ya existe una refacción con ese código.'},
              ]);
        }
        return conPartes([parteJson(1, 'BUJ-100')])(request);
      },
      log: log,
    );

    await tester.tap(find.text('Registrar refacción'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Código'), 'BUJ-100');
    await tester.enterText(find.widgetWithText(TextFormField, 'Nombre'), 'Bujía de iridio');
    await tester.enterText(find.widgetWithText(TextFormField, 'Categoría'), 'Motor');
    await tester.enterText(find.widgetWithText(TextFormField, 'Marca'), 'NGK');
    await tester.enterText(find.widgetWithText(TextFormField, 'Stock inicial (opcional)'), '12');
    await tester.enterText(find.widgetWithText(TextFormField, 'Stock mínimo'), '4');
    await tester.enterText(find.widgetWithText(TextFormField, 'Precio de compra'), '85.5');
    await tester.enterText(find.widgetWithText(TextFormField, 'Precio de venta'), '129.9');
    await tester.tap(find.text('Guardar refacción'));
    await tester.pumpAndSettle();

    final peticion = log.singleWhere((r) => r.method == 'POST' && r.url.path.endsWith('/parts'));
    expect(jsonDecode(peticion.body), {
      'code': 'BUJ-100',
      'name': 'Bujía de iridio',
      'category': 'Motor',
      'brand': 'NGK',
      'initialStock': 12,
      'minStock': 4,
      'purchasePrice': 85.5,
      'salePrice': 129.9,
    });
    expect(find.text('Ya existe una refacción con ese código.'), findsOneWidget);
  });

  testWidgets('desactivar una refacción pide confirmación antes de llamar al servidor', (tester) async {
    final log = <http.Request>[];
    await abrirInventario(
      tester,
      role: 'ADMIN',
      handler: (request) {
        if (request.method == 'PATCH') {
          return FakeResponse(200, {'data': parteJson(1, 'BUJ-100', activa: false)});
        }
        return conPartes([parteJson(1, 'BUJ-100')])(request);
      },
      log: log,
    );

    await tester.tap(find.byTooltip('Desactivar refacción'));
    await tester.pumpAndSettle();
    expect(find.textContaining('¿Seguro que quieres desactivar la refacción BUJ-100?'), findsOneWidget);
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(log.where((r) => r.method == 'PATCH'), isEmpty);

    await tester.tap(find.byTooltip('Desactivar refacción'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();
    expect(jsonDecode(log.singleWhere((r) => r.method == 'PATCH').body), {'active': false});
    expect(find.text('Refacción desactivada.'), findsOneWidget);
  });

  for (final rol in ['RECEPTIONIST', 'MECHANIC']) {
    testWidgets('el menú del rol $rol no ofrece «Inventario»', (tester) async {
      await abrirInventario(tester, role: rol, handler: conPartes([]));
      expect(find.text('Inventario'), findsNothing);
    });
  }
}
