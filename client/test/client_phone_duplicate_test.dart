import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

FakeResponse listaVacia() => FakeResponse(200, {
      'data': <Object>[],
      'meta': {'page': 1, 'pageSize': 10, 'total': 0},
    });

Map<String, dynamic> clienteJson() => {
      'id': 5,
      'name': 'Otra Ana',
      'phone': '55 1234 5678',
      'email': null,
      'active': true,
      'vehicleCount': 0,
      'createdAt': '2026-10-12T10:00:00.000Z',
      'updatedAt': '2026-10-12T10:00:00.000Z',
    };

FakeResponse duplicado() => apiError(
      409,
      'PHONE_DUPLICATE',
      'Ya existe un cliente activo con ese teléfono: Ana Pérez.',
      details: [
        {'field': 'phone', 'message': 'Ya existe un cliente activo con ese teléfono: Ana Pérez.'},
      ],
    );

Future<void> abrirFormulario(WidgetTester tester, FakeHandler handler, List<http.Request> log) async {
  tester.view.physicalSize = const Size(1400, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final api = fakeApi((request) {
    if (request.url.path.endsWith('/auth/login')) {
      return loginOk(role: 'RECEPTIONIST', username: 'recepcion');
    }
    return handler(request);
  }, log: log);
  await tester.pumpWidget(MotorixApp(api: api, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.widgetWithText(TextFormField, 'Usuario o correo electrónico'), 'recepcion');
  await tester.enterText(find.widgetWithText(TextFormField, 'Contraseña'), 'Clave2026');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Registrar cliente').first);
  await tester.pumpAndSettle();
  await tester.enterText(find.widgetWithText(TextFormField, 'Nombre'), 'Otra Ana');
  await tester.enterText(find.widgetWithText(TextFormField, 'Teléfono'), '55 1234 5678');
}

void main() {
  testWidgets('avisa con el nombre del cliente existente y no guarda si se cancela', (tester) async {
    final log = <http.Request>[];
    await abrirFormulario(tester, (request) {
      if (request.method == 'POST') {
        return duplicado();
      }
      return listaVacia();
    }, log);

    await tester.tap(find.text('Guardar cliente'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Ana Pérez'), findsWidgets);
    expect(find.text('Cancelar'), findsWidgets);

    await tester.tap(find.text('Cancelar').last);
    await tester.pumpAndSettle();

    final posts = log.where((r) => r.method == 'POST' && r.url.path.endsWith('/clients')).toList();
    expect(posts, hasLength(1), reason: 'al cancelar no se reenvía la petición');
    expect(find.text('Guardar cliente'), findsOneWidget, reason: 'sigue en el formulario');
  });

  testWidgets('al confirmar reenvía con confirmDuplicate verdadero y cierra el formulario', (tester) async {
    final log = <http.Request>[];
    await abrirFormulario(tester, (request) {
      if (request.method == 'POST') {
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        return body['confirmDuplicate'] == true ? FakeResponse(201, {'data': clienteJson()}) : duplicado();
      }
      return listaVacia();
    }, log);

    await tester.tap(find.text('Guardar cliente'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();

    final posts = log.where((r) => r.method == 'POST' && r.url.path.endsWith('/clients')).toList();
    expect(posts, hasLength(2));
    expect((jsonDecode(posts.last.body) as Map<String, dynamic>)['confirmDuplicate'], isTrue);
    expect(find.text('Guardar cliente'), findsNothing, reason: 'el formulario se cierra al guardar');
    expect(find.text('Cliente registrado correctamente.'), findsOneWidget);
  });

  testWidgets('sin duplicado guarda directamente sin pedir confirmación', (tester) async {
    final log = <http.Request>[];
    await abrirFormulario(tester, (request) {
      if (request.method == 'POST') {
        return FakeResponse(201, {'data': clienteJson()});
      }
      return listaVacia();
    }, log);

    await tester.tap(find.text('Guardar cliente'));
    await tester.pumpAndSettle();

    final posts = log.where((r) => r.method == 'POST' && r.url.path.endsWith('/clients')).toList();
    expect(posts, hasLength(1));
    expect((jsonDecode(posts.single.body) as Map<String, dynamic>).containsKey('confirmDuplicate'), isFalse);
  });
}
