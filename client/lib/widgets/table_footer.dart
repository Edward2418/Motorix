import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../utils/app_tokens.dart';

/// Pie de tabla con el rango mostrado y los botones de paginación.
class TableFooter extends StatelessWidget {
  const TableFooter({
    super.key,
    required this.page,
    required this.pageSize,
    required this.total,
    required this.onPageChanged,
  });

  final int page;
  final int pageSize;
  final int total;
  final ValueChanged<int> onPageChanged;

  @override
  Widget build(BuildContext context) {
    final first = total == 0 ? 0 : (page - 1) * pageSize + 1;
    final last = (page * pageSize).clamp(0, total);
    final totalPages = total == 0 ? 1 : (total / pageSize).ceil();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          Text('$first–$last de $total', style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(width: AppSpacing.sm),
          IconButton(
            tooltip: 'Página anterior',
            onPressed: page > 1 ? () => onPageChanged(page - 1) : null,
            icon: const Icon(LucideIcons.chevronLeft, size: AppSizes.icon),
          ),
          IconButton(
            tooltip: 'Página siguiente',
            onPressed: page < totalPages ? () => onPageChanged(page + 1) : null,
            icon: const Icon(LucideIcons.chevronRight, size: AppSizes.icon),
          ),
        ],
      ),
    );
  }
}
