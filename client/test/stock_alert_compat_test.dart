import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:motorix_client/models/part.dart';
import 'package:motorix_client/providers/navigation_provider.dart';
import 'package:motorix_client/providers/notifications_provider.dart';
import 'package:motorix_client/utils/app_theme.dart';
import 'package:motorix_client/widgets/notification_bell.dart';
import 'package:motorix_client/widgets/stock_alert_banner.dart';
import 'package:provider/provider.dart';

import 'helpers/fake_api.dart';

// FR-008: el aviso de reabastecimiento de Inventario no cambia con la campana y no la contradice.
// (La tarea hablaba de una «insignia del ícono de Inventario»; ese elemento no existe en el cliente: lo que hay es este
// aviso en la pantalla de Inventario y el indicador de refacciones por reponer del inicio, que ya prueba
// dashboard_screen_test.dart.)

Part parte(int id, String codigo, {int stock = 2, StockLevel nivel = StockLevel.low}) => Part(
      id: id,
      code: codigo,
      name: 'Pieza $codigo',
      category: 'Motor',
      brand: 'NGK',
      stock: stock,
      minStock: 5,
      stockLevel: nivel,
      salePrice: 100,
      active: true,
    );

Map<String, dynamic> aviso(String key, String type, int severity, int id) => {
      'key': key,
      'type': type,
      'severity': severity,
      'title': 'Pieza $id',
      'detail': 'Detalle',
      'read': false,
      'target': {'module': 'inventory', 'id': id},
    };

void main() {
  testWidgets('el aviso de Inventario y el grupo de stock de la campana cuentan las mismas refacciones', (tester) async {
    tester.view.physicalSize = const Size(1500, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final alertas = [parte(1, 'AGO-1', stock: 0, nivel: StockLevel.outOfStock), parte(2, 'BAJ-2'), parte(3, 'BAJ-3')];
    final api = fakeApi((request) {
      if (request.url.path.endsWith('/notifications/count')) {
        return FakeResponse(200, {
          'data': {'unread': 3},
        });
      }
      return FakeResponse(200, {
        'data': {
          'unread': 3,
          'groups': [
            {
              'type': 'STOCK_OUT',
              'label': 'Refacciones agotadas',
              'total': 1,
              'unread': 1,
              'items': [aviso('STOCK:1', 'STOCK_OUT', 2, 1)],
            },
            {
              'type': 'STOCK_LOW',
              'label': 'Stock bajo',
              'total': 2,
              'unread': 2,
              'items': [aviso('STOCK:2', 'STOCK_LOW', 1, 2), aviso('STOCK:3', 'STOCK_LOW', 1, 3)],
            },
          ],
        },
      });
    });
    final provider = NotificationsProvider(api);
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<NotificationsProvider>.value(value: provider),
          ChangeNotifierProvider<NavigationProvider>.value(value: NavigationProvider()),
        ],
        child: MaterialApp(
          theme: buildAppTheme(useGoogleFonts: false),
          home: Scaffold(
            body: Column(
              children: [
                const Align(alignment: Alignment.topRight, child: NotificationBell()),
                StockAlertBanner(alerts: alertas, lowOnly: false, onToggleLowOnly: (_) {}),
              ],
            ),
          ),
        ),
      ),
    );
    await provider.refreshCount();
    await tester.pumpAndSettle();

    // El aviso de Inventario sigue mostrándose igual que antes de la campana.
    expect(find.text('3 refacciones requieren reabastecimiento (1 agotada)'), findsOneWidget);

    await tester.tap(find.byIcon(LucideIcons.bell));
    await tester.pumpAndSettle();

    // La suma de los grupos de stock de la campana coincide con el número del aviso: 1 agotada + 2 bajas = 3.
    expect(find.text('Refacciones agotadas (1)'), findsOneWidget);
    expect(find.text('Stock bajo (2)'), findsOneWidget);
    // El aviso de Inventario no desaparece al abrir la campana.
    expect(find.text('3 refacciones requieren reabastecimiento (1 agotada)'), findsOneWidget);
  });
}
