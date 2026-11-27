import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/report_income.dart';
import '../models/report_rows.dart';
import '../providers/reports_provider.dart';
import '../services/api_client.dart';
import '../services/report_saver.dart';
import '../utils/app_tokens.dart';
import '../utils/formatters.dart';
import '../widgets/horizontal_scroll.dart';
import '../widgets/section_navigator.dart';
import '../widgets/table_footer.dart';
import '../widgets/view_states.dart';

/// Reportes de administración (solo ADMIN). Cada reporte es una pestaña y todas comparten el periodo; todo se calcula en
/// el servidor y aquí solo se consulta y se muestra.
class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> with SingleTickerProviderStateMixin {
  late final _tabs = TabController(length: ReportKind.values.length, vsync: this);
  final _from = TextEditingController();
  final _to = TextEditingController();
  String? _rangeError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final reports = context.read<ReportsProvider>();
      _from.text = reports.from;
      _to.text = reports.to;
      reports.open(ReportKind.values[_tabs.index]);
    });
    _tabs.addListener(() => context.read<ReportsProvider>().show(ReportKind.values[_tabs.index]));
  }

  @override
  void dispose() {
    _tabs.dispose();
    _from.dispose();
    _to.dispose();
    super.dispose();
  }

  void _selectShortcut(ReportShortcut shortcut) {
    final reports = context.read<ReportsProvider>();
    setState(() => _rangeError = null);
    reports.selectShortcut(shortcut);
    _from.text = reports.from;
    _to.text = reports.to;
  }

  void _query() {
    final error = validateReportRange(_from.text, _to.text);
    setState(() => _rangeError = error);
    if (error == null) {
      context.read<ReportsProvider>().applyRange(_from.text, _to.text);
    }
  }

  // Guarda en Descargas el CSV del rango que se está viendo y confirma con el nombre del archivo, o dice qué falló.
  Future<void> _export() async {
    final reports = context.read<ReportsProvider>();
    final saver = context.read<ReportSaver>();
    try {
      final path = await reports.exportActive(saver);
      if (mounted) {
        showFeedback(context, 'Reporte guardado en Descargas: ${path.split(RegExp(r'[\\/]')).last}.');
      }
    } on ApiException catch (e) {
      if (mounted) {
        showFeedback(context, 'No se pudo exportar el reporte. ${e.message}', error: true);
      }
    } on ReportSaveException catch (e) {
      if (mounted) {
        showFeedback(context, 'No se pudo guardar el reporte. ${e.message}', error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final reports = context.watch<ReportsProvider>();
    final theme = Theme.of(context);
    final active = reports.stateOf(reports.active);
    return PagePadding(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TabBar(
            controller: _tabs,
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            tabs: [for (final kind in ReportKind.values) Tab(text: kind.title)],
          ),
          const SizedBox(height: AppSpacing.lg),
          Wrap(
            spacing: AppSpacing.lg,
            runSpacing: AppSpacing.md,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              SegmentedButton<ReportShortcut>(
                emptySelectionAllowed: true,
                showSelectedIcon: false,
                segments: [for (final shortcut in ReportShortcut.values) ButtonSegment(value: shortcut, label: Text(shortcut.label))],
                selected: {if (reports.shortcut != null) reports.shortcut!},
                onSelectionChanged: (selection) {
                  if (selection.isNotEmpty) {
                    _selectShortcut(selection.first);
                  }
                },
              ),
              SizedBox(width: 190, child: TextFormField(controller: _from, decoration: const InputDecoration(labelText: 'Desde (AAAA-MM-DD)'))),
              SizedBox(width: 190, child: TextFormField(controller: _to, decoration: const InputDecoration(labelText: 'Hasta (AAAA-MM-DD)'))),
              FilledButton(onPressed: active.loading ? null : _query, child: const Text('Consultar')),
              OutlinedButton(
                onPressed: active.loading || reports.exporting || active.data == null ? null : _export,
                child: const Text('Exportar'),
              ),
            ],
          ),
          if (_rangeError != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(_rangeError!, style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.danger)),
          ],
          const SizedBox(height: AppSpacing.lg),
          Expanded(
            child: TabBarView(
              controller: _tabs,
              children: [for (final kind in ReportKind.values) _ReportBody(kind: kind)],
            ),
          ),
        ],
      ),
    );
  }
}

/// Estados de un reporte (carga, error, vacío) y su contenido, con paginación en los que son listas.
class _ReportBody extends StatelessWidget {
  const _ReportBody({required this.kind});

  final ReportKind kind;

  @override
  Widget build(BuildContext context) {
    final reports = context.watch<ReportsProvider>();
    final state = reports.stateOf(kind);
    final data = state.data;
    if (state.loading && data == null) {
      return const LoadingState();
    }
    if (state.error != null && data == null) {
      return ErrorState(message: state.error!, onRetry: () => reports.load(kind));
    }
    if (data == null) {
      return const SizedBox.shrink();
    }
    final String? empty = switch (data) {
      final IncomeReport income when income.isEmpty => 'No hay pagos cobrados en este periodo.',
      final PartsMargin margin when margin.items.isEmpty && state.total == 0 =>
        'No hay refacciones usadas en órdenes terminadas en este periodo.',
      final List<Object?> rows when rows.isEmpty && state.total == 0 => switch (kind) {
          ReportKind.services => 'No hay servicios en órdenes terminadas en este periodo.',
          ReportKind.productivity => 'No hay órdenes terminadas en este periodo.',
          _ => 'No hay existencias ni salidas en este periodo.',
        },
      _ => null,
    };
    if (empty != null) {
      return EmptyState(message: empty);
    }
    final content = switch (kind) {
      ReportKind.income => _IncomeContent(income: data as IncomeReport),
      ReportKind.services => _ServicesContent(rows: data as List<ServiceFrequencyRow>),
      ReportKind.productivity => _ProductivityContent(rows: data as List<ProductivityRow>),
      ReportKind.partsMargin => _PartsMarginContent(report: data as PartsMargin),
      ReportKind.turnover => _TurnoverContent(rows: data as List<TurnoverRow>),
    };
    if (!kind.paginated) {
      return content;
    }
    return Column(
      children: [
        Expanded(child: content),
        TableFooter(
          page: state.page,
          pageSize: state.pageSize,
          total: state.total,
          onPageChanged: (page) => reports.goToPage(kind, page),
        ),
      ],
    );
  }
}

/// Tarjeta con título, nota opcional y una tabla que, si no cabe, se desplaza en horizontal con la barra visible.
class _TableCard extends StatelessWidget {
  const _TableCard({required this.title, required this.columns, required this.rows, this.note});

  final String title;
  final String? note;
  final List<DataColumn> columns;
  final List<DataRow> rows;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: theme.textTheme.titleMedium),
            if (note != null) ...[const SizedBox(height: AppSpacing.xs), Text(note!, style: theme.textTheme.bodySmall)],
            const SizedBox(height: AppSpacing.sm),
            HorizontalScroll(child: DataTable(columns: columns, rows: rows)),
          ],
        ),
      ),
    );
  }
}

DataColumn _column(String label, {bool numeric = false}) => DataColumn(label: Text(label), numeric: numeric);

DataRow _row(List<String> cells) => DataRow(cells: [for (final cell in cells) DataCell(Text(cell))]);

String _optionalMoney(double? value) => value == null ? '—' : formatMoney(value);

/// Contenido desplazable de un reporte.
class _ReportScroll extends StatelessWidget {
  const _ReportScroll({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) =>
      SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children));
}

class _ServicesContent extends StatelessWidget {
  const _ServicesContent({required this.rows});

  final List<ServiceFrequencyRow> rows;

  @override
  Widget build(BuildContext context) => _ReportScroll(
        children: [
          _TableCard(
            title: 'Servicios más frecuentes',
            note: 'Servicios de las órdenes terminadas en el periodo.',
            columns: [_column('Servicio'), _column('Cantidad', numeric: true), _column('Importe', numeric: true)],
            rows: [for (final row in rows) _row([row.name, '${row.count}', formatMoney(row.total)])],
          ),
        ],
      );
}

class _ProductivityContent extends StatelessWidget {
  const _ProductivityContent({required this.rows});

  final List<ProductivityRow> rows;

  @override
  Widget build(BuildContext context) => _ReportScroll(
        children: [
          _TableCard(
            title: 'Productividad por mecánico',
            note: 'Cada orden cuenta una sola vez, en la fecha en que se terminó por primera vez.',
            columns: [_column('Mecánico'), _column('Órdenes terminadas', numeric: true), _column('Mano de obra', numeric: true)],
            rows: [for (final row in rows) _row([row.mechanicName, '${row.finishedOrders}', formatMoney(row.laborTotal)])],
          ),
        ],
      );
}

class _PartsMarginContent extends StatelessWidget {
  const _PartsMarginContent({required this.report});

  final PartsMargin report;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final totals = report.totals;
    Widget figure(String label, double value) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: theme.textTheme.bodySmall),
            Text(formatMoney(value), style: theme.textTheme.headlineSmall),
          ],
        );
    return _ReportScroll(
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: AppSpacing.xxl,
                  runSpacing: AppSpacing.md,
                  children: [
                    figure('Ventas de refacciones', totals.salesTotal),
                    figure('Costo', totals.costTotal),
                    figure('Margen', totals.marginTotal),
                  ],
                ),
                if (totals.withoutCostCount > 0) ...[
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    '${totals.withoutCostCount} ${totals.withoutCostCount == 1 ? 'refacción sin costo' : 'refacciones sin costo'}: '
                    'sus ventas se suman, pero no entran en el costo ni en el margen.',
                    style: theme.textTheme.bodyMedium,
                  ),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        _TableCard(
          title: 'Margen por refacción',
          note: 'Usa el precio de venta de cada orden y el precio de compra actual de la refacción.',
          columns: [
            _column('Código'),
            _column('Refacción'),
            _column('Piezas', numeric: true),
            _column('Precio de venta', numeric: true),
            _column('Precio de compra', numeric: true),
            _column('Margen por pieza', numeric: true),
            _column('Margen total', numeric: true),
            _column('Observación'),
          ],
          rows: [
            for (final row in report.items)
              _row([
                row.code,
                row.name,
                '${row.quantity}',
                formatMoney(row.salePrice),
                _optionalMoney(row.purchasePrice),
                _optionalMoney(row.marginPerUnit),
                _optionalMoney(row.marginTotal),
                row.withoutCost ? 'Sin costo' : '',
              ]),
          ],
        ),
      ],
    );
  }
}

class _TurnoverContent extends StatelessWidget {
  const _TurnoverContent({required this.rows});

  final List<TurnoverRow> rows;

  @override
  Widget build(BuildContext context) => _ReportScroll(
        children: [
          _TableCard(
            title: 'Rotación de inventario',
            note: 'Salidas del periodo entre la existencia promedio (inicial y final). '
                'Las devoluciones a inventario no se restan de las salidas.',
            columns: [
              _column('Código'),
              _column('Refacción'),
              _column('Unidades que salieron', numeric: true),
              _column('Existencia promedio', numeric: true),
              _column('Rotación', numeric: true),
            ],
            rows: [
              for (final row in rows)
                _row([
                  row.code,
                  row.name,
                  '${row.unitsOut}',
                  row.averageStock.toStringAsFixed(2),
                  row.turnover?.toStringAsFixed(2) ?? 'Sin existencia',
                ]),
            ],
          ),
        ],
      );
}

class _IncomeContent extends StatelessWidget {
  const _IncomeContent({required this.income});

  final IncomeReport income;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Total cobrado', style: theme.textTheme.bodySmall),
                        Text(formatMoney(income.total), style: theme.textTheme.headlineMedium),
                      ],
                    ),
                  ),
                  Text('${income.paymentsCount} ${income.paymentsCount == 1 ? 'pago' : 'pagos'}', style: theme.textTheme.titleMedium),
                ],
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Por método de pago', style: theme.textTheme.titleMedium),
                  const SizedBox(height: AppSpacing.sm),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: DataTable(
                      columns: const [
                        DataColumn(label: Text('Método')),
                        DataColumn(label: Text('Pagos'), numeric: true),
                        DataColumn(label: Text('Total'), numeric: true),
                      ],
                      rows: [
                        for (final row in income.byMethod)
                          DataRow(cells: [DataCell(Text(row.method.label)), DataCell(Text('${row.count}')), DataCell(Text(formatMoney(row.total)))]),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Por día', style: theme.textTheme.titleMedium),
                  const SizedBox(height: AppSpacing.sm),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: DataTable(
                      columns: const [
                        DataColumn(label: Text('Día')),
                        DataColumn(label: Text('Total'), numeric: true),
                      ],
                      rows: [
                        for (final row in income.byDay) DataRow(cells: [DataCell(Text(formatDate(row.date))), DataCell(Text(formatMoney(row.total)))]),
                      ],
                    ),
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
