import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../models/part.dart';
import '../utils/app_tokens.dart';
import '../utils/formatters.dart';

/// Aviso de reabastecimiento para la administración: resume las refacciones activas con stock bajo o agotado.
/// No ocupa espacio cuando no hay alertas. Usa el color de advertencia, o el de peligro si hay refacciones agotadas.
class StockAlertBanner extends StatelessWidget {
  const StockAlertBanner({
    super.key,
    required this.alerts,
    required this.lowOnly,
    required this.onToggleLowOnly,
    this.maxListed = 3,
  });

  final List<Part> alerts;

  /// El listado está filtrado a «solo stock bajo y agotado».
  final bool lowOnly;
  final ValueChanged<bool> onToggleLowOnly;
  final int maxListed;

  @override
  Widget build(BuildContext context) {
    if (alerts.isEmpty) {
      return const SizedBox.shrink();
    }
    final theme = Theme.of(context);
    final soldOut = alerts.where((part) => part.stockLevel == StockLevel.outOfStock).length;
    final color = soldOut > 0 ? AppColors.danger : AppColors.warning;
    final summary = alerts.length == 1
        ? '1 refacción requiere reabastecimiento'
        : '${alerts.length} refacciones requieren reabastecimiento';
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: AnimatedContainer(
        duration: AppDurations.state,
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          border: Border.all(color: color.withValues(alpha: 0.4)),
          borderRadius: BorderRadius.circular(AppRadius.panel),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(LucideIcons.triangleAlert, size: AppSizes.icon, color: color),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    soldOut > 0 ? '$summary ($soldOut ${soldOut == 1 ? 'agotada' : 'agotadas'})' : summary,
                    style: theme.textTheme.titleMedium?.copyWith(color: color),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  for (final part in alerts.take(maxListed))
                    Text(
                      '${part.code} · ${part.name}: ${formatQuantity(part.stock)} en existencia (mínimo ${formatQuantity(part.minStock)})',
                      style: theme.textTheme.bodyMedium,
                    ),
                  if (alerts.length > maxListed)
                    Text('y ${alerts.length - maxListed} más', style: theme.textTheme.bodySmall),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            OutlinedButton(
              onPressed: () => onToggleLowOnly(!lowOnly),
              child: Text(lowOnly ? 'Ver todas las refacciones' : 'Ver solo stock bajo'),
            ),
          ],
        ),
      ),
    );
  }
}
