import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/report_income.dart';
import '../providers/reports_provider.dart';
import '../utils/app_tokens.dart';
import '../utils/formatters.dart';
import '../widgets/section_navigator.dart';
import '../widgets/view_states.dart';

/// Reportes de administración (solo ADMIN). Cada reporte es una pestaña; todo se calcula en el servidor y aquí solo se
/// consulta y se muestra. Por ahora: Ingresos.
class ReportsScreen extends StatelessWidget {
  const ReportsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 1,
      child: PagePadding(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const TabBar(
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              tabs: [Tab(text: 'Ingresos')],
            ),
            const SizedBox(height: AppSpacing.lg),
            const Expanded(child: TabBarView(children: [_IncomeTab()])),
          ],
        ),
      ),
    );
  }
}

class _IncomeTab extends StatefulWidget {
  const _IncomeTab();

  @override
  State<_IncomeTab> createState() => _IncomeTabState();
}

class _IncomeTabState extends State<_IncomeTab> {
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
      reports.loadIncome();
    });
  }

  @override
  void dispose() {
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

  @override
  Widget build(BuildContext context) {
    final reports = context.watch<ReportsProvider>();
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
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
            FilledButton(onPressed: reports.loading ? null : _query, child: const Text('Consultar')),
          ],
        ),
        if (_rangeError != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(_rangeError!, style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.danger)),
        ],
        const SizedBox(height: AppSpacing.lg),
        Expanded(child: _body(context, reports)),
      ],
    );
  }

  Widget _body(BuildContext context, ReportsProvider reports) {
    final income = reports.income;
    if (reports.loading && income == null) {
      return const LoadingState();
    }
    if (reports.error != null && income == null) {
      return ErrorState(message: reports.error!, onRetry: reports.loadIncome);
    }
    if (income == null) {
      return const SizedBox.shrink();
    }
    if (income.isEmpty) {
      return const EmptyState(message: 'No hay pagos cobrados en este periodo.');
    }
    return _IncomeContent(income: income);
  }
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
