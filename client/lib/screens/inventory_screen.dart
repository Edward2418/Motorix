import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/part.dart';
import '../providers/clients_provider.dart';
import '../providers/parts_provider.dart';
import '../services/api_client.dart';
import '../utils/app_tokens.dart';
import '../utils/formatters.dart';
import '../widgets/cell_text.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/search_field.dart';
import '../widgets/section_navigator.dart';
import '../widgets/status_badge.dart';
import '../widgets/status_chip.dart';
import '../widgets/table_footer.dart';
import '../widgets/table_scroll.dart';
import '../widgets/view_states.dart';
import 'part_detail_screen.dart';
import 'part_form_screen.dart';

/// Inventario de refacciones (solo ADMIN): catálogo con búsqueda, filtros, estado y nivel de stock.
class InventoryScreen extends StatefulWidget {
  const InventoryScreen({super.key});

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final parts = context.read<PartsProvider>();
      parts.load();
      parts.loadCategories();
    });
  }

  Future<void> _openForm({Part? part}) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => PartFormScreen(part: part)),
    );
    if (saved == true && mounted) {
      showFeedback(context, part == null ? 'Refacción registrada correctamente.' : 'Refacción actualizada correctamente.');
    }
  }

  Future<void> _openDetail(Part part) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(builder: (_) => PartDetailScreen(partId: part.id)),
    );
    // Al volver se recarga el listado: el detalle pudo registrar entradas o ajustes.
    if (mounted) {
      context.read<PartsProvider>().load();
    }
  }

  Future<void> _toggleActive(Part part) async {
    final deactivate = part.active;
    final confirmed = await showConfirmDialog(
      context,
      message: deactivate
          ? '¿Seguro que quieres desactivar la refacción ${part.code}? Dejará de ofrecerse en las órdenes nuevas.'
          : '¿Seguro que quieres reactivar la refacción ${part.code}?',
    );
    if (!confirmed || !mounted) {
      return;
    }
    try {
      await context.read<PartsProvider>().setActive(part.id, !deactivate);
      if (mounted) {
        showFeedback(context, deactivate ? 'Refacción desactivada.' : 'Refacción reactivada.');
      }
    } on ApiException catch (e) {
      if (mounted) {
        showFeedback(context, e.message, error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final parts = context.watch<PartsProvider>();
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
                  hint: 'Buscar por código, nombre o marca',
                  onChanged: (value) => context.read<PartsProvider>().setSearch(value),
                ),
              ),
              DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: parts.categories.contains(parts.category) ? parts.category : '',
                  borderRadius: BorderRadius.circular(AppRadius.panel),
                  style: theme.textTheme.bodyMedium,
                  items: [
                    const DropdownMenuItem(value: '', child: Text('Todas las categorías')),
                    for (final category in parts.categories) DropdownMenuItem(value: category, child: Text(category)),
                  ],
                  onChanged: (value) => context.read<PartsProvider>().setCategory(value ?? ''),
                ),
              ),
              DropdownButtonHideUnderline(
                child: DropdownButton<StockLevel?>(
                  value: parts.stockLevel,
                  borderRadius: BorderRadius.circular(AppRadius.panel),
                  style: theme.textTheme.bodyMedium,
                  items: [
                    const DropdownMenuItem(value: null, child: Text('Todos los niveles')),
                    for (final level in StockLevel.values)
                      DropdownMenuItem(value: level, child: Text('Stock ${level.label.toLowerCase()}')),
                  ],
                  onChanged: (value) => context.read<PartsProvider>().setStockLevel(value),
                ),
              ),
              DropdownButtonHideUnderline(
                child: DropdownButton<ActiveFilter>(
                  value: parts.activeFilter,
                  borderRadius: BorderRadius.circular(AppRadius.panel),
                  style: theme.textTheme.bodyMedium,
                  items: [
                    for (final filter in ActiveFilter.values) DropdownMenuItem(value: filter, child: Text(filter.label)),
                  ],
                  onChanged: (value) {
                    if (value != null) {
                      context.read<PartsProvider>().setActiveFilter(value);
                    }
                  },
                ),
              ),
              FilledButton.icon(
                onPressed: () => _openForm(),
                icon: const Icon(LucideIcons.plus, size: AppSizes.icon),
                label: const Text('Registrar refacción'),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Expanded(
            child: Card(
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  Expanded(child: _buildBody(context, parts)),
                  const Divider(),
                  TableFooter(
                    page: parts.page,
                    pageSize: PartsProvider.pageSize,
                    total: parts.total,
                    onPageChanged: (page) => context.read<PartsProvider>().goToPage(page),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(BuildContext context, PartsProvider parts) {
    if (parts.loading && parts.items.isEmpty) {
      return const LoadingState();
    }
    if (parts.error != null) {
      return ErrorState(message: parts.error!, onRetry: () => context.read<PartsProvider>().load());
    }
    if (parts.items.isEmpty) {
      final filtered = parts.search.isNotEmpty || parts.category.isNotEmpty || parts.stockLevel != null;
      return EmptyState(
        message: filtered
            ? 'No se encontraron refacciones con esos filtros.'
            : 'Todavía no hay refacciones registradas.',
        actionLabel: filtered ? null : 'Registrar refacción',
        onAction: filtered ? null : () => _openForm(),
      );
    }
    return TableScroll(
      child: DataTable(
        columns: const [
          DataColumn(label: Text('Código')),
          DataColumn(label: Text('Nombre')),
          DataColumn(label: Text('Categoría')),
          DataColumn(label: Text('Marca')),
          DataColumn(label: Text('Stock'), numeric: true),
          DataColumn(label: Text('Mínimo'), numeric: true),
          DataColumn(label: Text('Nivel')),
          DataColumn(label: Text('Precio de venta'), numeric: true),
          DataColumn(label: Text('Estado')),
          DataColumn(label: Text('Acciones')),
        ],
        rows: [
          for (final part in parts.items)
            DataRow(
              cells: [
                DataCell(CellText(part.code, maxWidth: AppSizes.cellNarrow)),
                DataCell(CellText(part.name, maxWidth: AppSizes.cellWide)),
                DataCell(CellText(part.category, maxWidth: AppSizes.cellNarrow)),
                DataCell(CellText(part.brand, maxWidth: AppSizes.cellNarrow)),
                DataCell(Text(formatQuantity(part.stock))),
                DataCell(Text(formatQuantity(part.minStock))),
                DataCell(StatusBadge.stock(part.stockLevel)),
                DataCell(Text(formatMoney(part.salePrice))),
                DataCell(StatusChip(active: part.active)),
                DataCell(
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        tooltip: 'Ver movimientos',
                        onPressed: () => _openDetail(part),
                        icon: const Icon(LucideIcons.listOrdered, size: AppSizes.icon),
                      ),
                      IconButton(
                        tooltip: 'Editar refacción',
                        onPressed: () => _openForm(part: part),
                        icon: const Icon(LucideIcons.pencil, size: AppSizes.icon),
                      ),
                      IconButton(
                        tooltip: part.active ? 'Desactivar refacción' : 'Reactivar refacción',
                        onPressed: () => _toggleActive(part),
                        icon: Icon(part.active ? LucideIcons.ban : LucideIcons.rotateCcw, size: AppSizes.icon),
                      ),
                    ],
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}
