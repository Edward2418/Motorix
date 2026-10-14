import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/dashboard.dart';
import '../providers/navigation_provider.dart';
import '../utils/app_tokens.dart';
import '../utils/formatters.dart';
import 'status_badge.dart';

/// Etiquetas del menú a las que lleva cada lista (deben coincidir con `allDestinations`).
const String _ordersLabel = 'Órdenes de servicio';
const String _appointmentsLabel = 'Citas';
const String _maintenanceLabel = 'Mantenimientos';
const String _inventoryLabel = 'Inventario';

/// Listas de atención del panel: lo que requiere acción hoy. Cada elemento abre su módulo (o su orden).
class AttentionLists extends StatelessWidget {
  const AttentionLists({super.key, required this.dashboard});

  final Dashboard dashboard;

  @override
  Widget build(BuildContext context) {
    final navigation = context.read<NavigationProvider>();
    void open(String label, {int? orderId}) => navigation.select(label, orderId: orderId);

    return Wrap(
      spacing: AppSpacing.xl,
      runSpacing: AppSpacing.xl,
      children: [
        _AttentionCard(
          title: 'Órdenes terminadas',
          subtitle: 'En el periodo elegido',
          icon: LucideIcons.circleCheck,
          count: dashboard.finishedCount,
          emptyText: 'No hay órdenes terminadas en este periodo.',
          onSeeAll: () => open(_ordersLabel),
          rows: [
            for (final order in dashboard.finishedOrders)
              _Row(
                title: '${order.folio} · ${order.clientName}',
                subtitle: order.vehicleLabel,
                trailing: StatusBadge.order(order.status),
                onTap: () => open(_ordersLabel, orderId: order.id),
              ),
          ],
        ),
        _AttentionCard(
          title: 'Citas próximas',
          subtitle: 'Pendientes y confirmadas en los próximos 7 días',
          icon: LucideIcons.calendarDays,
          count: dashboard.upcomingCount,
          emptyText: 'No hay citas en los próximos 7 días.',
          onSeeAll: () => open(_appointmentsLabel),
          rows: [
            for (final appointment in dashboard.upcomingAppointments)
              _Row(
                title: '${formatDateTime(appointment.scheduledAt)} · ${appointment.clientName}',
                subtitle: appointment.vehicleLabel,
                onTap: () => open(_appointmentsLabel),
              ),
          ],
        ),
        _AttentionCard(
          title: 'Mantenimientos',
          subtitle: '${dashboard.maintenanceOverdue} vencidos · ${dashboard.maintenanceSoon} próximos',
          icon: LucideIcons.calendarClock,
          count: dashboard.maintenanceOverdue + dashboard.maintenanceSoon,
          emptyText: 'No hay mantenimientos vencidos ni próximos.',
          onSeeAll: () => open(_maintenanceLabel),
          rows: [
            for (final item in dashboard.maintenanceItems)
              _Row(
                title: '${item.description} · ${item.vehicleLabel}',
                subtitle: item.clientName,
                trailing: StatusBadge.maintenance(item.visualStatus),
                onTap: () => open(_maintenanceLabel),
              ),
          ],
        ),
        _AttentionCard(
          title: 'Stock bajo',
          subtitle: 'Refacciones por reponer',
          icon: LucideIcons.packageOpen,
          count: dashboard.lowStockParts,
          emptyText: 'No hay refacciones con stock bajo.',
          onSeeAll: () => open(_inventoryLabel),
          rows: [
            for (final part in dashboard.lowStockItems)
              _Row(
                title: '${part.code} · ${part.name}',
                subtitle: 'Existencia ${part.stock} · mínimo ${part.minStock}',
                trailing: StatusBadge.stock(part.stockLevel),
                onTap: () => open(_inventoryLabel),
              ),
          ],
        ),
        _AttentionCard(
          title: 'Saldo por cobrar',
          subtitle: dashboard.pendingBalanceCount == 0
              ? 'Todo cobrado'
              : '${formatMoney(dashboard.pendingBalanceTotal)} en ${dashboard.pendingBalanceCount} órdenes',
          icon: LucideIcons.banknote,
          count: dashboard.pendingBalanceCount,
          emptyText: 'No hay órdenes con saldo por cobrar.',
          onSeeAll: () => open(_ordersLabel),
          rows: [
            for (final order in dashboard.pendingBalanceOrders)
              _Row(
                title: '${order.folio} · ${order.clientName}',
                subtitle: order.vehicleLabel,
                trailing: Text(formatMoney(order.balance)),
                onTap: () => open(_ordersLabel, orderId: order.id),
              ),
          ],
        ),
      ],
    );
  }
}

class _Row {
  const _Row({required this.title, required this.subtitle, required this.onTap, this.trailing});

  final String title;
  final String subtitle;
  final Widget? trailing;
  final VoidCallback onTap;
}

class _AttentionCard extends StatelessWidget {
  const _AttentionCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.count,
    required this.emptyText,
    required this.rows,
    required this.onSeeAll,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final int count;
  final String emptyText;
  final List<_Row> rows;
  final VoidCallback onSeeAll;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SizedBox(
      width: AppSizes.attentionCardWidth,
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Row(
                children: [
                  Icon(icon, size: AppSizes.icon, color: AppColors.primary),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('$title ($count)', style: theme.textTheme.titleMedium),
                        Text(subtitle, style: theme.textTheme.bodySmall),
                      ],
                    ),
                  ),
                  if (count > 0)
                    TextButton(
                      onPressed: onSeeAll,
                      child: Text('Ver todo', semanticsLabel: 'Ver todo en $title'),
                    ),
                ],
              ),
            ),
            const Divider(height: 1),
            if (rows.isEmpty)
              Padding(
                padding: const EdgeInsets.all(AppSpacing.xl),
                child: Text(emptyText, style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.textSecondary)),
              )
            else
              for (final row in rows) ...[
                InkWell(
                  onTap: row.onTap,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl, vertical: AppSpacing.md),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(row.title, style: theme.textTheme.bodyMedium, overflow: TextOverflow.ellipsis, maxLines: 2),
                              Text(row.subtitle, style: theme.textTheme.bodySmall, overflow: TextOverflow.ellipsis, maxLines: 1),
                            ],
                          ),
                        ),
                        if (row.trailing != null) ...[const SizedBox(width: AppSpacing.md), row.trailing!],
                      ],
                    ),
                  ),
                ),
                const Divider(height: 1),
              ],
          ],
        ),
      ),
    );
  }
}
