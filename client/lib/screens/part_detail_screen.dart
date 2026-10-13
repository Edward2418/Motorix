import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/inventory_movement.dart';
import '../models/part.dart';
import '../providers/parts_provider.dart';
import '../services/api_client.dart';
import '../utils/app_tokens.dart';
import '../utils/formatters.dart';
import '../widgets/cell_text.dart';
import '../widgets/movement_dialog.dart';
import '../widgets/section_navigator.dart';
import '../widgets/status_badge.dart';
import '../widgets/status_chip.dart';
import '../widgets/table_footer.dart';
import '../widgets/table_scroll.dart';
import '../widgets/view_states.dart';

/// Detalle de una refacción (administración): datos, stock y el historial completo de movimientos,
/// con las acciones para registrar entradas y ajustes por conteo físico.
class PartDetailScreen extends StatefulWidget {
  const PartDetailScreen({super.key, required this.partId});

  final int partId;

  @override
  State<PartDetailScreen> createState() => _PartDetailScreenState();
}

class _PartDetailScreenState extends State<PartDetailScreen> {
  Part? _part;
  List<InventoryMovement> _movements = const [];
  int _total = 0;
  int _page = 1;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = _part == null;
      _error = null;
    });
    try {
      final parts = context.read<PartsProvider>();
      final part = await parts.fetch(widget.partId);
      final movements = await parts.loadMovements(widget.partId, page: _page);
      if (mounted) {
        setState(() {
          _part = part;
          _movements = movements.items;
          _total = movements.total;
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _error = e.message);
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _entry() async {
    final input = await showEntryDialog(context, part: _part!);
    if (input == null || !mounted) {
      return;
    }
    await _register(
      () => context.read<PartsProvider>().registerEntry(_part!.id, quantity: input.quantity, reason: input.reason),
      'Entrada registrada.',
    );
  }

  Future<void> _adjustment() async {
    final input = await showAdjustmentDialog(context, part: _part!);
    if (input == null || !mounted) {
      return;
    }
    await _register(
      () => context.read<PartsProvider>().registerAdjustment(_part!.id, countedStock: input.countedStock, reason: input.reason),
      'Inventario ajustado.',
    );
  }

  Future<void> _register(Future<InventoryMovement> Function() action, String success) async {
    try {
      await action();
      if (!mounted) {
        return;
      }
      _page = 1;
      await _load();
      if (mounted) {
        showFeedback(context, success);
      }
    } on ApiException catch (e) {
      if (mounted) {
        showFeedback(context, e.message, error: true);
      }
    }
  }

  void _goToPage(int page) {
    _page = page;
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_part == null ? 'Detalle de la refacción' : '${_part!.code} · ${_part!.name}'),
        backgroundColor: AppColors.surface,
        scrolledUnderElevation: 0,
      ),
      body: _buildBody(context),
    );
  }

  Widget _buildBody(BuildContext context) {
    if (_loading) {
      return const LoadingState();
    }
    if (_error != null) {
      return ErrorState(message: _error!, onRetry: _load);
    }
    final part = _part!;
    final theme = Theme.of(context);
    return PagePadding(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: AppSpacing.xxl,
                    runSpacing: AppSpacing.lg,
                    children: [
                      _Field(label: 'Categoría', value: part.category),
                      _Field(label: 'Marca', value: part.brand),
                      _Field(label: 'Stock actual', value: formatQuantity(part.stock)),
                      _Field(label: 'Stock mínimo', value: formatQuantity(part.minStock)),
                      _Field(label: 'Nivel', child: StatusBadge.stock(part.stockLevel)),
                      _Field(label: 'Precio de compra', value: part.purchasePrice == null ? '—' : formatMoney(part.purchasePrice!)),
                      _Field(label: 'Precio de venta', value: formatMoney(part.salePrice)),
                      _Field(label: 'Estado', child: StatusChip(active: part.active)),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Wrap(
                    spacing: AppSpacing.md,
                    runSpacing: AppSpacing.md,
                    children: [
                      FilledButton.icon(
                        onPressed: _entry,
                        icon: const Icon(LucideIcons.packagePlus, size: AppSizes.icon),
                        label: const Text('Registrar entrada'),
                      ),
                      OutlinedButton.icon(
                        onPressed: _adjustment,
                        icon: const Icon(LucideIcons.scale, size: AppSizes.icon),
                        label: const Text('Ajustar inventario'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          Text('Movimientos de inventario', style: theme.textTheme.titleLarge),
          const SizedBox(height: AppSpacing.md),
          Expanded(
            child: Card(
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  Expanded(
                    child: _movements.isEmpty
                        ? const EmptyState(message: 'Esta refacción todavía no tiene movimientos.')
                        : TableScroll(
                            child: DataTable(
                              columns: const [
                                DataColumn(label: Text('Fecha')),
                                DataColumn(label: Text('Tipo')),
                                DataColumn(label: Text('Cantidad'), numeric: true),
                                DataColumn(label: Text('Stock resultante'), numeric: true),
                                DataColumn(label: Text('Motivo')),
                                DataColumn(label: Text('Orden')),
                                DataColumn(label: Text('Usuario')),
                              ],
                              rows: [
                                for (final movement in _movements)
                                  DataRow(
                                    cells: [
                                      DataCell(Text(formatDateTime(movement.createdAt))),
                                      DataCell(Text(movement.type.label)),
                                      DataCell(Text(
                                        '${movement.quantity > 0 ? '+' : ''}${formatQuantity(movement.quantity)}',
                                        style: TextStyle(
                                          color: movement.quantity > 0 ? AppColors.success : AppColors.danger,
                                        ),
                                      )),
                                      DataCell(Text(formatQuantity(movement.stockAfter))),
                                      DataCell(CellText(movement.reason, maxWidth: AppSizes.cellWide)),
                                      DataCell(Text(movement.orderFolio ?? '—')),
                                      DataCell(CellText(movement.createdByName, maxWidth: AppSizes.cellNarrow)),
                                    ],
                                  ),
                              ],
                            ),
                          ),
                  ),
                  const Divider(),
                  TableFooter(
                    page: _page,
                    pageSize: PartsProvider.movementsPageSize,
                    total: _total,
                    onPageChanged: _goToPage,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({required this.label, this.value, this.child});

  final String label;
  final String? value;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: theme.textTheme.bodySmall),
        const SizedBox(height: AppSpacing.xs),
        child ?? Text(value ?? '—', style: theme.textTheme.bodyLarge),
      ],
    );
  }
}
