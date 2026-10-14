import 'package:flutter_test/flutter_test.dart';

import 'dashboard_screen_test.dart';
import 'helpers/fake_api.dart';

Map<String, dynamic> atencionCompleta() => {
      'finishedOrders': {
        'count': 2,
        'items': [ordenRef(1, estado: 'TERMINADO'), ordenRef(2, estado: 'ENTREGADO')],
      },
      'upcomingAppointments': {
        'count': 1,
        'items': [
          {
            'id': 5,
            'scheduledAt': '2026-10-15T16:00:00.000Z',
            'clientName': 'Luis Gómez',
            'vehicleLabel': 'XYZ9999 · Honda Civic 2019',
            'status': 'CONFIRMADA',
          },
        ],
      },
      'maintenance': {
        'overdue': 1,
        'soon': 1,
        'items': [
          {'id': 1, 'description': 'Cambio de aceite', 'vehicleLabel': 'ABC1231 · Nissan', 'clientName': 'Ana Pérez', 'visualStatus': 'VENCIDO'},
          {'id': 2, 'description': 'Frenos', 'vehicleLabel': 'ABC1232 · Nissan', 'clientName': 'Ana Pérez', 'visualStatus': 'PROXIMO'},
        ],
      },
      'lowStockParts': {
        'count': 1,
        'items': [
          {'id': 3, 'code': 'BUJ-100', 'name': 'Bujía de iridio', 'stock': 0, 'minStock': 3, 'stockLevel': 'AGOTADO'},
        ],
      },
      'pendingBalance': {
        'total': 1750.5,
        'count': 2,
        'items': [ordenRef(7, total: 1500, saldo: 1250.5), ordenRef(8, total: 500, saldo: 500)],
      },
    };

void main() {
  Future<({dynamic navegacion, dynamic log})> abrir(WidgetTester tester) =>
      abrirPanel(tester, handler: (_) => FakeResponse(200, {'data': panelJson(atencion: atencionCompleta(), stockBajo: 1)}));

  testWidgets('cada lista muestra sus elementos', (tester) async {
    await abrir(tester);
    expect(find.text('Órdenes terminadas (2)'), findsOneWidget);
    expect(find.textContaining('OS-2026-0001 · Cliente 1'), findsOneWidget);
    expect(find.text('Citas próximas (1)'), findsOneWidget);
    expect(find.textContaining('Luis Gómez'), findsOneWidget);
    expect(find.text('Mantenimientos (2)'), findsOneWidget);
    expect(find.text('1 vencidos · 1 próximos'), findsOneWidget);
    expect(find.text('Stock bajo (1)'), findsOneWidget);
    expect(find.textContaining('BUJ-100 · Bujía de iridio'), findsOneWidget);
    expect(find.text('Saldo por cobrar (2)'), findsOneWidget);
  });

  testWidgets('los mantenimientos vencidos aparecen primero', (tester) async {
    await abrir(tester);
    final vencido = tester.getTopLeft(find.textContaining('Cambio de aceite')).dy;
    final proximo = tester.getTopLeft(find.textContaining('Frenos')).dy;
    expect(vencido, lessThan(proximo));
  });

  testWidgets('el saldo por cobrar se muestra con formato de moneda', (tester) async {
    await abrir(tester);
    expect(find.text('\$1,750.50 en 2 órdenes'), findsOneWidget);
    expect(find.text('\$1,250.50'), findsOneWidget);
    expect(find.text('\$500.00'), findsOneWidget);
  });

  testWidgets('con listas vacías cada una muestra su estado vacío', (tester) async {
    await abrirPanel(tester, handler: (_) => FakeResponse(200, {'data': panelJson()}));
    expect(find.text('No hay citas en los próximos 7 días.'), findsOneWidget);
    expect(find.text('No hay mantenimientos vencidos ni próximos.'), findsOneWidget);
    expect(find.text('No hay refacciones con stock bajo.'), findsOneWidget);
    expect(find.text('No hay órdenes con saldo por cobrar.'), findsOneWidget);
  });

  testWidgets('un clic en una orden, cita, mantenimiento o refacción abre su módulo', (tester) async {
    final servidor = await abrir(tester);
    final nav = servidor.navegacion;

    await tester.tap(find.textContaining('OS-2026-0007 · Cliente 7'));
    await tester.pumpAndSettle();
    expect(nav.selectedLabel, 'Órdenes de servicio');
    expect(nav.takePendingOrderId(), 7);

    await tester.tap(find.textContaining('Luis Gómez'));
    await tester.pumpAndSettle();
    expect(nav.selectedLabel, 'Citas');

    await tester.tap(find.textContaining('Cambio de aceite'));
    await tester.pumpAndSettle();
    expect(nav.selectedLabel, 'Mantenimientos');

    await tester.tap(find.textContaining('BUJ-100'));
    await tester.pumpAndSettle();
    expect(nav.selectedLabel, 'Inventario');
  });
}
