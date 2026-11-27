import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Future<void> abrir(WidgetTester tester, Size ventana) async {
  tester.view.physicalSize = ventana;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final api = fakeApi((request) {
    final ruta = request.url.path;
    if (ruta.endsWith('/auth/login')) {
      return FakeResponse(200, {
        'data': {'token': 't', 'expiresIn': 28800, 'user': userJson(), 'termsAccepted': true},
      });
    }
    if (ruta.endsWith('/notifications/count')) {
      return FakeResponse(200, {'data': {'unread': 0}});
    }
    if (ruta.endsWith('/settings')) {
      return FakeResponse(200, {
        'data': {
          'workshop': {'name': 'Taller', 'address': 'Dirección', 'phone': '55 0000 0000', 'source': 'default'},
          'maintenance': {'soonDays': 30, 'soonKm': 1000, 'source': 'default'},
          'updatedAt': null,
          'updatedByName': null,
        },
      });
    }
    if (ruta.endsWith('/service-types')) {
      return FakeResponse(200, {
        'data': [
          {'id': 1, 'name': 'Cambio de bomba de agua', 'intervalDays': 1095, 'intervalKm': 80000, 'active': true},
        ],
      });
    }
    if (ruta.endsWith('/terms/current')) {
      return FakeResponse(200, {'data': null});
    }
    return listaVacia();
  });
  await tester.pumpWidget(MotorixApp(api: api, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.widgetWithText(TextFormField, 'Usuario o correo electrónico'), 'usuario');
  await tester.enterText(find.widgetWithText(TextFormField, 'Contraseña'), 'Clave2026');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Configuración').first);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('en una ventana de escritorio se ve el botón de desactivar sin desplazarse en horizontal', (tester) async {
    await abrir(tester, const Size(1400, 2000));

    final boton = find.byTooltip('Desactivar Cambio de bomba de agua');
    final tarjeta = find.ancestor(of: boton, matching: find.byType(Card)).first;

    expect(tester.getRect(boton).right, lessThanOrEqualTo(tester.getRect(tarjeta).right), reason: 'el botón queda recortado');
    expect(boton.hitTestable(), findsOneWidget);
  });

  testWidgets('en una ventana angosta la tabla muestra una barra de desplazamiento horizontal', (tester) async {
    await abrir(tester, const Size(1400, 2000));
    tester.view.physicalSize = const Size(1000, 2000);
    await tester.pumpAndSettle();

    final barra = tester.widget<Scrollbar>(
      find.ancestor(of: find.byType(DataTable), matching: find.byType(Scrollbar)).first,
    );
    expect(barra.thumbVisibility, isTrue);
    expect(barra.controller!.position.maxScrollExtent, greaterThan(0));
  });
}
