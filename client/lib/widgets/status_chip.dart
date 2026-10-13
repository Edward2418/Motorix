import 'package:flutter/material.dart';

import '../utils/app_tokens.dart';

/// Chip discreto de estado activo / inactivo.
class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.active});

  final bool active;

  @override
  Widget build(BuildContext context) {
    final color = active ? AppColors.success : AppColors.textSecondary;
    return AnimatedContainer(
      duration: AppDurations.state,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        border: Border.all(color: color.withValues(alpha: 0.4)),
        borderRadius: BorderRadius.circular(AppRadius.panel),
      ),
      child: Text(
        active ? 'Activo' : 'Inactivo',
        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: color),
      ),
    );
  }
}
