import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/history_entry.dart';
import '../providers/vehicles_provider.dart';
import '../services/api_client.dart';
import '../utils/app_tokens.dart';
import '../utils/formatters.dart';
import '../widgets/section_navigator.dart';
import '../widgets/status_badge.dart';
import '../widgets/table_footer.dart';
import '../widgets/view_states.dart';

/// Historial de servicios de un vehículo (solo lectura): las órdenes terminadas y entregadas,
/// de la más reciente a la más antigua.
class VehicleHistoryScreen extends StatefulWidget {
  const VehicleHistoryScreen({super.key, required this.vehicleId, required this.title});

  final int vehicleId;

  /// Placa y descripción del vehículo, para el encabezado.
  final String title;

  @override
  State<VehicleHistoryScreen> createState() => _VehicleHistoryScreenState();
}

class _VehicleHistoryScreenState extends State<VehicleHistoryScreen> {
  List<HistoryEntry> _entries = const [];
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
      _loading = true;
      _error = null;
    });
    try {
      final page = await context.read<VehiclesProvider>().loadHistory(widget.vehicleId, page: _page);
      if (mounted) {
        setState(() {
          _entries = page.entries;
          _total = page.total;
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _error = e.message);
      }
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'El servidor devolvió una respuesta inesperada.');
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
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
        title: Text('Historial de servicios · ${widget.title}'),
        backgroundColor: AppColors.surface,
        scrolledUnderElevation: 0,
      ),
      body: _buildBody(context),
    );
  }

  Widget _buildBody(BuildContext context) {
    if (_loading && _entries.isEmpty) {
      return const LoadingState();
    }
    if (_error != null) {
      return ErrorState(message: _error!, onRetry: _load);
    }
    if (_entries.isEmpty) {
      return const EmptyState(message: 'Este vehículo aún no tiene servicios finalizados.');
    }
    return PagePadding(
      child: Column(
        children: [
          Expanded(
            child: ListView.separated(
              itemCount: _entries.length,
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.lg),
              itemBuilder: (_, index) => _HistoryCard(entry: _entries[index]),
            ),
          ),
          const Divider(),
          TableFooter(
            page: _page,
            pageSize: VehiclesProvider.historyPageSize,
            total: _total,
            onPageChanged: _goToPage,
          ),
        ],
      ),
    );
  }
}

class _HistoryCard extends StatelessWidget {
  const _HistoryCard({required this.entry});

  final HistoryEntry entry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(entry.folio, style: theme.textTheme.titleLarge),
                const SizedBox(width: AppSpacing.md),
                StatusBadge.order(entry.status),
                const Spacer(),
                Text(formatDate(entry.serviceDate), style: theme.textTheme.bodyLarge),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Wrap(
              spacing: AppSpacing.xxl,
              runSpacing: AppSpacing.sm,
              children: [
                Text('Kilometraje del servicio: ${formatMileage(entry.serviceMileage)}', style: theme.textTheme.bodyMedium),
                Text('Mecánico: ${entry.mechanicName}', style: theme.textTheme.bodyMedium),
                Text('Total: ${formatMoney(entry.total)}', style: theme.textTheme.bodyMedium),
              ],
            ),
            _Block(title: 'Problema reportado', lines: [entry.reportedProblem]),
            if (entry.diagnosis != null) _Block(title: 'Diagnóstico', lines: [entry.diagnosis!]),
            _Block(
              title: 'Servicios realizados',
              lines: [for (final s in entry.services) '${s.description} · ${formatMoney(s.amount)}'],
              emptyText: 'No se registraron servicios.',
            ),
            if (entry.labor.isNotEmpty)
              _Block(title: 'Mano de obra', lines: [for (final l in entry.labor) '${l.description} · ${formatMoney(l.amount)}']),
            if (entry.parts.isNotEmpty)
              _Block(
                title: 'Refacciones',
                lines: [
                  for (final p in entry.parts)
                    '${p.quantity} × ${p.name} (${p.code}) · ${formatMoney(p.subtotal)}',
                ],
              ),
            if (entry.notes != null) _Block(title: 'Observaciones', lines: [entry.notes!]),
            if (entry.recommendations != null) _Block(title: 'Recomendaciones', lines: [entry.recommendations!]),
          ],
        ),
      ),
    );
  }
}

class _Block extends StatelessWidget {
  const _Block({required this.title, required this.lines, this.emptyText});

  final String title;
  final List<String> lines;
  final String? emptyText;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: theme.textTheme.bodySmall),
          const SizedBox(height: AppSpacing.xs),
          if (lines.isEmpty)
            Text(emptyText ?? '—', style: theme.textTheme.bodyMedium)
          else
            for (final line in lines) Text(line, style: theme.textTheme.bodyMedium),
        ],
      ),
    );
  }
}
