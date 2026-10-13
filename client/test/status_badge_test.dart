import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/models/maintenance.dart';
import 'package:motorix_client/models/part.dart';
import 'package:motorix_client/utils/app_tokens.dart';
import 'package:motorix_client/utils/formatters.dart';
import 'package:motorix_client/widgets/status_badge.dart';

Widget envolver(Widget hijo) => MaterialApp(home: Scaffold(body: Center(child: hijo)));

void main() {
  testWidgets('la insignia de mantenimiento muestra la etiqueta de cada estado visual', (tester) async {
    for (final estado in MaintenanceVisualStatus.values) {
      await tester.pumpWidget(envolver(StatusBadge.maintenance(estado)));
      expect(find.text(estado.label), findsOneWidget, reason: 'Debe mostrar ${estado.label}');
    }
  });

  test('los colores de mantenimiento siguen normal gris, próximo ámbar y vencido rojo', () {
    expect(maintenanceStatusColor(MaintenanceVisualStatus.normal), AppColors.textSecondary);
    expect(maintenanceStatusColor(MaintenanceVisualStatus.soon), AppColors.warning);
    expect(maintenanceStatusColor(MaintenanceVisualStatus.overdue), AppColors.danger);
  });

  testWidgets('la insignia de stock muestra la etiqueta de cada nivel', (tester) async {
    for (final nivel in StockLevel.values) {
      await tester.pumpWidget(envolver(StatusBadge.stock(nivel)));
      expect(find.text(nivel.label), findsOneWidget, reason: 'Debe mostrar ${nivel.label}');
    }
  });

  test('los colores de stock siguen normal verde, bajo ámbar y agotado rojo', () {
    expect(stockLevelColor(StockLevel.normal), AppColors.success);
    expect(stockLevelColor(StockLevel.low), AppColors.warning);
    expect(stockLevelColor(StockLevel.outOfStock), AppColors.danger);
  });

  test('solo los niveles bajo y agotado requieren reabastecer', () {
    expect(StockLevel.normal.needsRestock, isFalse);
    expect(StockLevel.low.needsRestock, isTrue);
    expect(StockLevel.outOfStock.needsRestock, isTrue);
  });

  test('formatQuantity separa los miles con coma', () {
    expect(formatQuantity(0), '0');
    expect(formatQuantity(999), '999');
    expect(formatQuantity(1250), '1,250');
    expect(formatQuantity(99999999), '99,999,999');
  });
}
