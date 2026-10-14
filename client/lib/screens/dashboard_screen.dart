import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/dashboard.dart';
import '../providers/dashboard_provider.dart';
import '../providers/navigation_provider.dart';
import '../utils/app_tokens.dart';
import '../utils/formatters.dart';
import '../widgets/attention_lists.dart';
import '../widgets/dashboard_indicator.dart';
import '../widgets/order_bars_chart.dart';
import '../widgets/section_navigator.dart';
import '../widgets/view_states.dart';

/// Panel de control (solo administración): cuatro indicadores, órdenes por estado y listas de atención.
/// Todo se calcula en el servidor al consultar; aquí solo se muestra.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<DashboardProvider>().load());
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<DashboardProvider>();
    final dashboard = provider.dashboard;
    final theme = Theme.of(context);

    Widget body;
    if (provider.loading && dashboard == null) {
      body = const LoadingState();
    } else if (provider.error != null && dashboard == null) {
      body = ErrorState(message: provider.error!, onRetry: provider.load);
    } else if (dashboard == null) {
      body = const SizedBox.shrink();
    } else {
      body = _Content(dashboard: dashboard, period: provider.period);
    }

    return PagePadding(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text('Resumen del taller', style: theme.textTheme.titleLarge)),
              SegmentedButton<DashboardPeriod>(
                showSelectedIcon: false,
                segments: [
                  for (final period in DashboardPeriod.values) ButtonSegment(value: period, label: Text(period.label)),
                ],
                selected: {provider.period},
                onSelectionChanged: (selection) => provider.setPeriod(selection.first),
              ),
              IconButton(
                tooltip: 'Actualizar panel',
                onPressed: provider.loading ? null : provider.load,
                icon: const Icon(LucideIcons.refreshCw, size: AppSizes.icon),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xl),
          Expanded(child: body),
        ],
      ),
    );
  }
}

class _Content extends StatelessWidget {
  const _Content({required this.dashboard, required this.period});

  final Dashboard dashboard;
  final DashboardPeriod period;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final navigation = context.read<NavigationProvider>();
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: AppSpacing.xl,
            runSpacing: AppSpacing.xl,
            children: [
              SizedBox(
                width: AppSizes.indicatorWidth,
                child: DashboardIndicator(
                  title: 'Vehículos en reparación',
                  value: '${dashboard.vehiclesInRepair}',
                  icon: LucideIcons.wrench,
                  helper: 'Órdenes en reparación ahora',
                  onTap: () => navigation.select('Órdenes de servicio'),
                ),
              ),
              SizedBox(
                width: AppSizes.indicatorWidth,
                child: DashboardIndicator(
                  title: 'Órdenes pendientes',
                  value: '${dashboard.openOrders}',
                  icon: LucideIcons.clipboardList,
                  helper: 'Todavía sin entregar ni cancelar',
                  color: AppColors.warning,
                  onTap: () => navigation.select('Órdenes de servicio'),
                ),
              ),
              SizedBox(
                width: AppSizes.indicatorWidth,
                child: DashboardIndicator(
                  title: 'Importe cobrado',
                  value: formatMoney(dashboard.collected),
                  icon: LucideIcons.banknote,
                  helper: period.label,
                  color: AppColors.success,
                ),
              ),
              SizedBox(
                width: AppSizes.indicatorWidth,
                child: DashboardIndicator(
                  title: 'Refacciones con stock bajo',
                  value: '${dashboard.lowStockParts}',
                  icon: LucideIcons.packageOpen,
                  helper: 'Bajas o agotadas',
                  color: dashboard.lowStockParts > 0 ? AppColors.danger : AppColors.textSecondary,
                  onTap: () => navigation.select('Inventario'),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xl),
          Text('Órdenes por estado', style: theme.textTheme.titleLarge),
          const SizedBox(height: AppSpacing.md),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: dashboard.totalOrders == 0
                  ? Text(
                      'Todavía no hay órdenes registradas.',
                      style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.textSecondary),
                    )
                  : OrderBarsChart(items: dashboard.ordersByStatus),
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          Text('Requiere atención', style: theme.textTheme.titleLarge),
          const SizedBox(height: AppSpacing.md),
          AttentionLists(dashboard: dashboard),
          const SizedBox(height: AppSpacing.xl),
        ],
      ),
    );
  }
}
