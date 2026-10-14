import 'package:flutter/material.dart';

import '../models/dashboard.dart';
import '../utils/app_tokens.dart';
import 'status_badge.dart';

/// Gráfica de barras horizontales con las órdenes por estado. Se dibuja con widgets propios (sin librerías de gráficas):
/// cada barra usa el color del estado y su ancho es proporcional a la mayor cantidad.
class OrderBarsChart extends StatelessWidget {
  const OrderBarsChart({super.key, required this.items});

  final List<StatusCount> items;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final maxCount = items.fold<int>(0, (max, item) => item.count > max ? item.count : max);
    final total = items.fold<int>(0, (sum, item) => sum + item.count);
    return Semantics(
      container: true,
      label: 'Órdenes por estado: $total en total',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final item in items)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
              child: Row(
                children: [
                  SizedBox(
                    width: AppSizes.chartLabelWidth,
                    child: Text(item.status.label, style: theme.textTheme.bodyMedium, overflow: TextOverflow.ellipsis),
                  ),
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(AppRadius.panel),
                      child: Container(
                        height: AppSizes.chartBarHeight,
                        color: AppColors.background,
                        alignment: Alignment.centerLeft,
                        child: FractionallySizedBox(
                          widthFactor: maxCount == 0 ? 0 : item.count / maxCount,
                          child: Container(color: orderStatusColor(item.status)),
                        ),
                      ),
                    ),
                  ),
                  SizedBox(
                    width: AppSizes.chartCountWidth,
                    child: Text('${item.count}', style: theme.textTheme.bodyMedium, textAlign: TextAlign.end),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
