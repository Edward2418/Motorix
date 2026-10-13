import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/service_order.dart';
import '../providers/auth_provider.dart';
import '../providers/orders_provider.dart';
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
import 'order_form_screen.dart';

/// Listado de órdenes de servicio. El mecánico solo recibe las que tiene asignadas (lo impone el servidor).
class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<OrdersProvider>().load());
  }

  Future<void> _create() async {
    final order = await Navigator.of(context).push<ServiceOrder>(
      MaterialPageRoute(builder: (_) => const OrderFormScreen()),
    );
    if (order != null && mounted) {
      await context.read<OrdersProvider>().load();
      if (!mounted) {
        return;
      }
      showFeedback(context, 'Orden ${order.folio} creada correctamente.');
      _open(order.id);
    }
  }

  Future<void> _open(int id) async {
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => OrderDetailScreen(orderId: id)));
    if (mounted) {
      await context.read<OrdersProvider>().load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final orders = context.watch<OrdersProvider>();
    final canCreate = context.select<AuthProvider, bool>((auth) => auth.user?.role.canManageRecords ?? false);
    final theme = Theme.of(context);

    return PagePadding(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              SizedBox(
                width: AppSizes.searchWidth,
                child: SearchField(
                  hint: 'Buscar por folio, placa o cliente',
                  onChanged: (value) => context.read<OrdersProvider>().setSearch(value),
                ),
              ),
              const SizedBox(width: AppSpacing.lg),
              DropdownButtonHideUnderline(
                child: DropdownButton<OrderStatus?>(
                  value: orders.statusFilter,
                  borderRadius: BorderRadius.circular(AppRadius.panel),
                  style: theme.textTheme.bodyMedium,
                  items: [
                    const DropdownMenuItem<OrderStatus?>(value: null, child: Text('Todos los estados')),
                    for (final status in OrderStatus.values)
                      DropdownMenuItem<OrderStatus?>(value: status, child: Text(status.label)),
                  ],
                  onChanged: (value) => context.read<OrdersProvider>().setStatusFilter(value),
                ),
              ),
              const Spacer(),
              if (canCreate)
                FilledButton.icon(
                  onPressed: _create,
                  icon: const Icon(LucideIcons.plus, size: AppSizes.icon),
                  label: const Text('Crear orden'),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Expanded(
            child: Card(
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  Expanded(child: _buildBody(context, orders, canCreate)),
                  const Divider(),
                  TableFooter(
                    page: orders.page,
                    pageSize: OrdersProvider.pageSize,
                    total: orders.total,
                    onPageChanged: (page) => context.read<OrdersProvider>().goToPage(page),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(BuildContext context, OrdersProvider orders, bool canCreate) {
    if (orders.loading && orders.items.isEmpty) {
      return const LoadingState();
    }
    if (orders.error != null) {
      return ErrorState(message: orders.error!, onRetry: () => context.read<OrdersProvider>().load());
    }
    if (orders.items.isEmpty) {
      final filtered = orders.search.isNotEmpty || orders.statusFilter != null;
      return EmptyState(
        message: filtered
            ? 'No se encontraron órdenes con esos filtros.'
            : canCreate
                ? 'Todavía no hay órdenes de servicio.'
                : 'No tienes órdenes asignadas por el momento.',
        actionLabel: canCreate && !filtered ? 'Crear orden' : null,
        onAction: canCreate ? _create : null,
      );
    }
    return TableScroll(
      child: DataTable(
        showCheckboxColumn: false,
        columns: [
          const DataColumn(label: Text('Folio')),
          const DataColumn(label: Text('Cliente')),
          const DataColumn(label: Text('Vehículo')),
          const DataColumn(label: Text('Mecánico')),
          const DataColumn(label: Text('Estado')),
          // El estado de pago solo lo recibe administración y recepción.
          if (canCreate) const DataColumn(label: Text('Pago')),
          const DataColumn(label: Text('Total'), numeric: true),
          const DataColumn(label: Text('Recibida')),
          const DataColumn(label: Text('Acciones')),
        ],
        rows: [
          for (final order in orders.items)
            DataRow(
              onSelectChanged: (_) => _open(order.id),
              cells: [
                DataCell(Text(order.folio)),
                DataCell(CellText(order.clientName, maxWidth: AppSizes.cellNarrow)),
                DataCell(CellText(order.vehicleLabel, maxWidth: AppSizes.cellWide)),
                DataCell(CellText(order.mechanicName, maxWidth: AppSizes.cellNarrow)),
                DataCell(StatusBadge.order(order.status)),
                if (canCreate)
                  DataCell(
                    order.paymentStatus == null
                        ? const Text('—')
                        : StatusBadge.orderPayment(order.paymentStatus!),
                  ),
                DataCell(Text(formatMoney(order.total))),
                DataCell(Text(formatDate(order.createdAt))),
                DataCell(
                  IconButton(
                    tooltip: 'Ver orden',
                    onPressed: () => _open(order.id),
                    icon: const Icon(LucideIcons.eye, size: AppSizes.icon),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}
