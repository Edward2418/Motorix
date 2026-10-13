import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';
import 'vehicles_screen_test.dart' show vehicleJson;

Map<String, dynamic> entradaJson(String folio, String fecha, {String estado = 'ENTREGADO', int km = 46000}) => {
      'orderId': 1,
      'folio': folio,
      'status': estado,
      'serviceDate': fecha,
      'serviceMileage': km,
      'mechanicName': 'Mecánico Uno',
      'reportedProblem': 'Ruido al frenar',
      'diagnosis': 'Balatas gastadas',
      'notes': null,
      'recommendations': 'Revisar discos en el próximo servicio',
      'services': [
        {'description': 'Cambio de balatas', 'amount': 1200.0},
      ],
      'labor': [
        {'description': 'Mano de obra de frenos', 'amount': 350.0},
      ],
      'parts': [
        {'partId': 3, 'code': 'BAL-01', 'name': 'Balatas delanteras', 'quantity': 1, 'unitPrice': 800.0},
      ],
      'total': 2350.0,
    };

FakeResponse historial(List<Map<String, dynamic>> entradas) => FakeResponse(200, {
      'data': entradas,
      'meta': {'page': 1, 'pageSize': 5, 'total': entradas.length},
    });

Future<void> abrirHistorial(
  WidgetTester tester, {
  required FakeResponse Function(http.Request request) historyHandler,
  String role = 'MECHANIC',
}) async {
  tester.view.physicalSize = const Size(1400, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final api = fakeApi((request) {
    final path = request.url.path;
    if (path.endsWith('/auth/login')) {
      return loginOk(role: role);
    }
    if (path.endsWith('/history')) {
      return historyHandler(request);
    }
    if (path.endsWith('/vehicles')) {
      return FakeResponse(200, {
        'data': [vehicleJson(7, 'ABC1234')],
        'meta': {'page': 1, 'pageSize': 10, 'total': 1},
      });
    }
    return listaVacia();
  });
  await tester.pumpWidget(MotorixApp(api: api, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.widgetWithText(TextFormField, 'Usuario o correo electrónico'), 'usuario');
  await tester.enterText(find.widgetWithText(TextFormField, 'Contraseña'), 'Clave2026');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Vehículos').first);
  await tester.pumpAndSettle();
  await tester.tap(find.byTooltip('Ver historial de servicios'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('muestra los servicios del vehículo con sus detalles', (tester) async {
    await abrirHistorial(
      tester,
      historyHandler: (_) => historial([
        entradaJson('OS-2026-0002', '2026-09-20T10:00:00.000Z'),
        entradaJson('OS-2026-0001', '2026-08-01T10:00:00.000Z', km: 45000),
      ]),
    );

    expect(find.textContaining('Historial de servicios · ABC1234'), findsOneWidget);
    expect(find.text('OS-2026-0002'), findsOneWidget);
    expect(find.text('OS-2026-0001'), findsOneWidget);
    expect(find.text('Cambio de balatas · \$1,200.00'), findsNWidgets(2));
    expect(find.text('1 × Balatas delanteras (BAL-01) · \$800.00'), findsNWidgets(2));
    expect(find.text('Kilometraje del servicio: 46,000 km'), findsOneWidget);
    expect(find.text('Revisar discos en el próximo servicio'), findsNWidgets(2));
  });

  testWidgets('un vehículo sin servicios finalizados muestra el estado vacío', (tester) async {
    await abrirHistorial(tester, historyHandler: (_) => historial([]));
    expect(find.text('Este vehículo aún no tiene servicios finalizados.'), findsOneWidget);
  });

  testWidgets('un error del servidor se muestra con la opción de reintentar', (tester) async {
    var intentos = 0;
    await abrirHistorial(
      tester,
      historyHandler: (_) {
        intentos++;
        return intentos == 1
            ? apiError(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado. Inténtalo de nuevo.')
            : historial([entradaJson('OS-2026-0003', '2026-09-20T10:00:00.000Z')]);
      },
    );

    expect(find.text('Ocurrió un error inesperado. Inténtalo de nuevo.'), findsOneWidget);
    await tester.tap(find.text('Reintentar'));
    await tester.pumpAndSettle();
    expect(find.text('OS-2026-0003'), findsOneWidget);
  });

  for (final rol in ['ADMIN', 'RECEPTIONIST', 'MECHANIC']) {
    testWidgets('el rol $rol puede abrir el historial desde la lista de vehículos', (tester) async {
      await abrirHistorial(
        tester,
        role: rol,
        historyHandler: (_) => historial([entradaJson('OS-2026-0009', '2026-09-20T10:00:00.000Z')]),
      );
      expect(find.text('OS-2026-0009'), findsOneWidget);
    });
  }
}
