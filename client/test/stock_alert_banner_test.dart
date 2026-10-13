import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/models/part.dart';
import 'package:motorix_client/utils/app_theme.dart';
import 'package:motorix_client/widgets/stock_alert_banner.dart';

import 'helpers/fake_api.dart';
import 'inventory_screen_test.dart' show abrirInventario, paginaPartes, parteJson;

Part parte(int id, String codigo, {int stock = 2, int minimo = 5, StockLevel nivel = StockLevel.low}) => Part(
      id: id,
      code: codigo,
      name: 'Pieza $codigo',
      category: 'Motor',
      brand: 'NGK',
      stock: stock,
      minStock: minimo,
      stockLevel: nivel,
      salePrice: 100,
      active: true,
    );

Future<void> montar(WidgetTester tester, StockAlertBanner banner) async {
  await tester.pumpWidget(MaterialApp(theme: buildAppTheme(useGoogleFonts: false), home: Scaffold(body: banner)));
}

void main() {
  group('StockAlertBanner', () {
    testWidgets('resume las refacciones en alerta y lista las primeras', (tester) async {
      await montar(
        tester,
        StockAlertBanner(
          alerts: [
            parte(1, 'AGO-1', stock: 0, nivel: StockLevel.outOfStock),
            parte(2, 'BAJ-2'),
            parte(3, 'BAJ-3'),
            parte(4, 'BAJ-4'),
          ],
          lowOnly: false,
          onToggleLowOnly: (_) {},
        ),
      );

      expect(find.text('4 refacciones requieren reabastecimiento (1 agotada)'), findsOneWidget);
      expect(find.textContaining('AGO-1 · Pieza AGO-1: 0 en existencia (mínimo 5)'), findsOneWidget);
      expect(find.textContaining('BAJ-3'), findsOneWidget);
      expect(find.textContaining('BAJ-4'), findsNothing, reason: 'solo se listan las primeras tres');
      expect(find.text('y 1 más'), findsOneWidget);
    });

    testWidgets('con una sola refacción usa el singular', (tester) async {
      await montar(tester, StockAlertBanner(alerts: [parte(1, 'BAJ-1')], lowOnly: false, onToggleLowOnly: (_) {}));
      expect(find.text('1 refacción requiere reabastecimiento'), findsOneWidget);
    });

    testWidgets('sin alertas no se muestra ni ocupa espacio', (tester) async {
      await montar(tester, StockAlertBanner(alerts: const [], lowOnly: false, onToggleLowOnly: (_) {}));
      expect(tester.getSize(find.byType(StockAlertBanner)), Size.zero);
      expect(find.byType(OutlinedButton), findsNothing);
    });

    testWidgets('el botón alterna el filtro de stock bajo', (tester) async {
      final cambios = <bool>[];
      await montar(tester, StockAlertBanner(alerts: [parte(1, 'BAJ-1')], lowOnly: false, onToggleLowOnly: cambios.add));
      await tester.tap(find.text('Ver solo stock bajo'));
      expect(cambios, [true]);

      await montar(tester, StockAlertBanner(alerts: [parte(1, 'BAJ-1')], lowOnly: true, onToggleLowOnly: cambios.add));
      await tester.tap(find.text('Ver todas las refacciones'));
      expect(cambios, [true, false]);
    });
  });

  group('en la pantalla de Inventario', () {
    testWidgets('el aviso aparece con las alertas, el botón filtra y desaparece al reabastecer', (tester) async {
      var hayAlertas = true;
      final log = <dynamic>[];
      await abrirInventario(
        tester,
        role: 'ADMIN',
        handler: (request) {
          final path = request.url.path;
          log.add('${request.method} $path ${request.url.query}');
          if (path.endsWith('/parts/categories')) {
            return FakeResponse(200, {'data': <Object>[]});
          }
          if (path.endsWith('/parts/alerts')) {
            return FakeResponse(200, {
              'data': hayAlertas ? [parteJson(2, 'FIL-200', nombre: 'Filtro', stock: 2, nivel: 'BAJO')] : <Object>[],
            });
          }
          if (path.endsWith('/parts')) {
            return paginaPartes([parteJson(1, 'BUJ-100'), parteJson(2, 'FIL-200', nombre: 'Filtro', stock: 2, nivel: 'BAJO')]);
          }
          return listaVacia();
        },
      );

      expect(find.text('1 refacción requiere reabastecimiento'), findsOneWidget);

      await tester.tap(find.text('Ver solo stock bajo'));
      await tester.pumpAndSettle();
      expect(log.where((e) => e.toString().contains('lowStock=true')), isNotEmpty);
      expect(find.text('Ver todas las refacciones'), findsOneWidget);

      // Simula una entrada de mercancía: ya no hay alertas y al recargar el aviso desaparece.
      hayAlertas = false;
      await tester.tap(find.text('Ver todas las refacciones'));
      await tester.pumpAndSettle();
      expect(find.textContaining('requiere reabastecimiento'), findsNothing);
      expect(find.textContaining('requieren reabastecimiento'), findsNothing);
    });
  });
}
