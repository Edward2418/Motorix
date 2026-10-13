import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/maintenance.dart';
import '../providers/maintenance_provider.dart';
import '../utils/app_tokens.dart';
import '../utils/formatters.dart';
import '../widgets/cell_text.dart';
import '../widgets/search_field.dart';
import '../widgets/section_navigator.dart';
import '../widgets/status_badge.dart';
import '../widgets/table_footer.dart';
import '../widgets/table_scroll.dart';
import '../widgets/view_states.dart';
import 'order_detail_screen.dart';

/// Mantenimientos programados de todos los vehículos, con su estado (Normal, Próximo o Vencido), el cliente y su
/// teléfono, para que recepción avise a quien corresponda. Los vencidos y los próximos aparecen primero.
class MaintenanceScreen extends StatefulWidget {
  const MaintenanceScreen({super.key});

  @override
  State<MaintenanceScreen> createState() => _MaintenanceScreenState();
}

class _MaintenanceScreenState extends State<MaintenanceScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<MaintenanceProvider>().load());
  }

  void _openOrder(Maintenance item) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => OrderDetailScreen(orderId: item.orderId)),
    );
  }

  String _target(Maintenance item) {
    final parts = [
      if (item.dueDate != null) formatDate(item.dueDate!),
      if (item.dueMileage != null) formatMileage(item.dueMileage!),
    ];
    return parts.join(' o ');
  }

  /// «En 12 días · 800 km», «Hace 3 días» o «1,200 km excedidos», según lo que aplique al mantenimiento.
  String _remaining(Maintenance item) {
    if (item.status != MaintenanceStatus.scheduled) {
      return '—';
    }
    final parts = <String>[];
    final days = item.remainingDays;
    if (days != null) {
      parts.add(days == 0 ? 'Hoy' : (days > 0 ? 'En $days ${days == 1 ? 'día' : 'días'}' : 'Hace ${-days} ${days == -1 ? 'día' : 'días'}'));
    }
    final km = item.remainingKm;
    if (km != null) {
      parts.add(km > 0 ? '${formatMileage(km)} restantes' : '${formatMileage(-km)} excedidos');
    }
    return parts.isEmpty ? '—' : parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final maintenance = context.watch<MaintenanceProvider>();
    final theme = Theme.of(context);

    return PagePadding(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: AppSpacing.lg,
            runSpacing: AppSpacing.md,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              SizedBox(
                width: AppSizes.searchWidth,
                child: SearchField(
                  hint: 'Buscar por placa, cliente o descripción',
                  onChanged: (value) => context.read<MaintenanceProvider>().setSearch(value),
                ),
              ),
              DropdownButtonHideUnderline(
                child: DropdownButton<MaintenanceStatus>(
                  value: maintenance.lifecycle,
                  borderRadius: BorderRadius.circular(AppRadius.panel),
                  style: theme.textTheme.bodyMedium,
                  items: const [
                    DropdownMenuItem(value: MaintenanceStatus.scheduled, child: Text('Pendientes')),
                    DropdownMenuItem(value: MaintenanceStatus.fulfilled, child: Text('Atendidos')),
                    DropdownMenuItem(value: MaintenanceStatus.cancelled, child: Text('Cancelados')),
                  ],
                  onChanged: (value) {
                    if (value != null) {
                      context.read<MaintenanceProvider>().setLifecycle(value);
                    }
                  },
                ),
              ),
              if (maintenance.lifecycle == MaintenanceStatus.scheduled)
                DropdownButtonHideUnderline(
                  child: DropdownButton<MaintenanceVisualStatus?>(
                    value: maintenance.visualStatus,
                    borderRadius: BorderRadius.circular(AppRadius.panel),
                    style: theme.textTheme.bodyMedium,
                    items: const [
                      DropdownMenuItem(value: null, child: Text('Todos los estados')),
                      DropdownMenuItem(value: MaintenanceVisualStatus.overdue, child: Text('Vencidos')),
                      DropdownMenuItem(value: MaintenanceVisualStatus.soon, child: Text('Próximos')),
                      DropdownMenuItem(value: MaintenanceVisualStatus.normal, child: Text('Normales')),
                    ],
                    onChanged: (value) => context.read<MaintenanceProvider>().setVisualStatus(value),
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Expanded(
            child: Card(
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  Expanded(child: _buildBody(context, maintenance)),
                  const Divider(),
                  TableFooter(
                    page: maintenance.page,
                    pageSize: MaintenanceProvider.pageSize,
                    total: maintenance.total,
                    onPageChanged: (page) => context.read<MaintenanceProvider>().goToPage(page),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(BuildContext context, MaintenanceProvider maintenance) {
    if (maintenance.loading && maintenance.items.isEmpty) {
      return const LoadingState();
    }
    if (maintenance.error != null) {
      return ErrorState(message: maintenance.error!, onRetry: () => context.read<MaintenanceProvider>().load());
    }
    if (maintenance.items.isEmpty) {
      final filtered = maintenance.search.isNotEmpty || maintenance.visualStatus != null;
      return EmptyState(
        message: filtered
            ? 'No se encontraron mantenimientos con esos filtros.'
            : switch (maintenance.lifecycle) {
                MaintenanceStatus.scheduled => 'No hay mantenimientos pendientes por avisar.',
                MaintenanceStatus.fulfilled => 'Todavía no hay mantenimientos atendidos.',
                MaintenanceStatus.cancelled => 'No hay mantenimientos cancelados.',
              },
      );
    }
    return TableScroll(
      child: DataTable(
        columns: const [
          DataColumn(label: Text('Estado')),
          DataColumn(label: Text('Vehículo')),
          DataColumn(label: Text('Cliente')),
          DataColumn(label: Text('Teléfono')),
          DataColumn(label: Text('Mantenimiento')),
          DataColumn(label: Text('Programado para')),
          DataColumn(label: Text('Restante')),
          DataColumn(label: Text('Orden de origen')),
        ],
        rows: [
          for (final item in maintenance.items)
            DataRow(
              cells: [
                DataCell(
                  item.visualStatus != null
                      ? StatusBadge.maintenance(item.visualStatus!)
                      : StatusBadge(label: item.status.label, color: AppColors.textSecondary),
                ),
                DataCell(CellText(item.vehicleLabel, maxWidth: AppSizes.cellWide)),
                DataCell(CellText(item.clientName, maxWidth: AppSizes.cellNarrow)),
                DataCell(Text(item.clientPhone)),
                DataCell(CellText(item.description, maxWidth: AppSizes.cellWide)),
                DataCell(Text(_target(item))),
                DataCell(Text(_remaining(item))),
                DataCell(
                  TextButton.icon(
                    onPressed: () => _openOrder(item),
                    icon: const Icon(LucideIcons.externalLink, size: AppSizes.icon),
                    label: Text(item.orderFolio),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}
