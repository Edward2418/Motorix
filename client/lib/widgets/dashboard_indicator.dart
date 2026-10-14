import 'package:flutter/material.dart';

import '../utils/app_tokens.dart';

/// Indicador del panel: título, cifra grande y una ayuda opcional. Si recibe [onTap], abre el módulo relacionado.
class DashboardIndicator extends StatelessWidget {
  const DashboardIndicator({
    super.key,
    required this.title,
    required this.value,
    required this.icon,
    this.helper,
    this.color = AppColors.primary,
    this.onTap,
  });

  final String title;
  final String value;
  final String? helper;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Semantics(
      container: true,
      label: '$title: $value',
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Icon(icon, size: AppSizes.icon, color: color),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(child: Text(title, style: theme.textTheme.bodyMedium)),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                Text(value, style: theme.textTheme.headlineMedium?.copyWith(color: color)),
                if (helper != null) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(helper!, style: theme.textTheme.bodySmall),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
