import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/audit_entry.dart';
import '../providers/audit_provider.dart';
import '../utils/app_tokens.dart';
import '../utils/formatters.dart';
import '../widgets/section_navigator.dart';
import '../widgets/table_footer.dart';
import '../widgets/table_scroll.dart';
import '../widgets/view_states.dart';

/// Bitácora de acciones sensibles (solo ADMIN): inicios fallidos, cambios de usuarios, de configuración y de precios, y
/// pagos cancelados. Es de solo consulta: no tiene acciones para editar ni borrar registros.
class AuditScreen extends StatefulWidget {
  const AuditScreen({super.key});

  @override
  State<AuditScreen> createState() => _AuditScreenState();
}

class _AuditScreenState extends State<AuditScreen> {
  static const _dateMessage = 'Escribe la fecha como AAAA-MM-DD, por ejemplo 2026-11-01.';

  final _formKey = GlobalKey<FormState>();
  final _from = TextEditingController();
  final _to = TextEditingController();
  int? _userId;
  String? _action;
  String? _rangeError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final audit = context.read<AuditProvider>();
      audit.load();
      audit.loadUsers();
    });
  }

  @override
  void dispose() {
    _from.dispose();
    _to.dispose();
    super.dispose();
  }

  // Fecha real con el formato AAAA-MM-DD (rechaza, por ejemplo, 2026-02-30).
  static DateTime? _parse(String text) {
    final match = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(text);
    if (match == null) {
      return null;
    }
    final year = int.parse(match.group(1)!);
    final month = int.parse(match.group(2)!);
    final day = int.parse(match.group(3)!);
    final date = DateTime(year, month, day);
    return date.year == year && date.month == month && date.day == day ? date : null;
  }

  static String? _validateDate(String? value) {
    final text = (value ?? '').trim();
    if (text.isEmpty) {
      return null;
    }
    return _parse(text) == null ? _dateMessage : null;
  }

  void _apply() {
    setState(() => _rangeError = null);
    if (!_formKey.currentState!.validate()) {
      return;
    }
    final from = _from.text.trim();
    final to = _to.text.trim();
    if (from.isNotEmpty && to.isNotEmpty && _parse(from)!.isAfter(_parse(to)!)) {
      setState(() => _rangeError = 'La fecha inicial no puede ser posterior a la final.');
      return;
    }
    context.read<AuditProvider>().applyFilters(from: from, to: to, userId: _userId, action: _action);
  }

  void _clear() {
    _from.clear();
    _to.clear();
    setState(() {
      _userId = null;
      _action = null;
      _rangeError = null;
    });
    context.read<AuditProvider>().clearFilters();
  }

  @override
  Widget build(BuildContext context) {
    final audit = context.watch<AuditProvider>();
    final theme = Theme.of(context);

    return PagePadding(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Form(
            key: _formKey,
            child: Wrap(
              spacing: AppSpacing.lg,
              runSpacing: AppSpacing.md,
              crossAxisAlignment: WrapCrossAlignment.start,
              children: [
                SizedBox(
                  width: 190,
                  child: TextFormField(
                    controller: _from,
                    decoration: const InputDecoration(labelText: 'Desde (AAAA-MM-DD)'),
                    validator: _validateDate,
                  ),
                ),
                SizedBox(
                  width: 190,
                  child: TextFormField(
                    controller: _to,
                    decoration: const InputDecoration(labelText: 'Hasta (AAAA-MM-DD)'),
                    validator: _validateDate,
                  ),
                ),
                DropdownButtonHideUnderline(
                  child: DropdownButton<int?>(
                    value: _userId,
                    borderRadius: BorderRadius.circular(AppRadius.panel),
                    style: theme.textTheme.bodyMedium,
                    items: [
                      const DropdownMenuItem<int?>(value: null, child: Text('Todos los usuarios')),
                      for (final user in audit.users) DropdownMenuItem<int?>(value: user.id, child: Text(user.name)),
                    ],
                    onChanged: (value) => setState(() => _userId = value),
                  ),
                ),
                DropdownButtonHideUnderline(
                  child: DropdownButton<String?>(
                    value: _action,
                    borderRadius: BorderRadius.circular(AppRadius.panel),
                    style: theme.textTheme.bodyMedium,
                    items: [
                      const DropdownMenuItem<String?>(value: null, child: Text('Todas las acciones')),
                      for (final entry in auditActionLabels.entries)
                        DropdownMenuItem<String?>(value: entry.key, child: Text(entry.value)),
                    ],
                    onChanged: (value) => setState(() => _action = value),
                  ),
                ),
                FilledButton(onPressed: _apply, child: const Text('Aplicar filtros')),
                TextButton(onPressed: _clear, child: const Text('Limpiar')),
              ],
            ),
          ),
          if (_rangeError != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(_rangeError!, style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.danger)),
          ],
          const SizedBox(height: AppSpacing.lg),
          Expanded(
            child: Card(
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  Expanded(child: _buildBody(context, audit)),
                  const Divider(),
                  TableFooter(
                    page: audit.page,
                    pageSize: AuditProvider.pageSize,
                    total: audit.total,
                    onPageChanged: (page) => context.read<AuditProvider>().goToPage(page),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(BuildContext context, AuditProvider audit) {
    if (audit.loading && audit.items.isEmpty) {
      return const LoadingState();
    }
    if (audit.error != null) {
      return ErrorState(message: audit.error!, onRetry: () => context.read<AuditProvider>().load());
    }
    if (audit.items.isEmpty) {
      return const EmptyState(message: 'No hay registros con esos filtros.');
    }
    return TableScroll(
      child: DataTable(
        columns: const [
          DataColumn(label: Text('Fecha')),
          DataColumn(label: Text('Usuario')),
          DataColumn(label: Text('Acción')),
          DataColumn(label: Text('Detalle')),
        ],
        rows: [
          for (final entry in audit.items)
            DataRow(
              cells: [
                DataCell(Text(formatDateTime(entry.createdAt))),
                DataCell(Text(entry.actor ?? 'Sin usuario')),
                DataCell(Text(entry.actionLabel)),
                DataCell(Text(entry.detail ?? '')),
              ],
            ),
        ],
      ),
    );
  }
}
