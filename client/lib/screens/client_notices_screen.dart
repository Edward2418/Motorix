import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/client_notice.dart';
import '../providers/client_notices_provider.dart';
import '../utils/app_tokens.dart';
import '../utils/formatters.dart';
import '../widgets/cell_text.dart';
import '../widgets/section_navigator.dart';
import '../widgets/table_scroll.dart';
import '../widgets/view_states.dart';

/// Clientes por avisar: orden terminada sin entregar, cita de mañana y mantenimiento próximo o vencido, con el
/// teléfono para llamar. Marcar a uno como avisado pide una nota opcional y lo saca de la lista.
class ClientNoticesScreen extends StatefulWidget {
  const ClientNoticesScreen({super.key});

  @override
  State<ClientNoticesScreen> createState() => _ClientNoticesScreenState();
}

class _ClientNoticesScreenState extends State<ClientNoticesScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<ClientNoticesProvider>().load());
  }

  Future<void> _markNotified(PendingClientNotice notice) async {
    final note = await showDialog<String>(
      context: context,
      builder: (_) => _NoteDialog(clientName: notice.clientName),
    );
    // Cancelar devuelve null: no se registra nada.
    if (note == null || !mounted) {
      return;
    }
    final error = await context.read<ClientNoticesProvider>().register(notice, note: note);
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(error ?? 'Aviso registrado: ${notice.clientName}.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ClientNoticesProvider>();
    return PagePadding(
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: _buildBody(context, provider),
      ),
    );
  }

  Widget _buildBody(BuildContext context, ClientNoticesProvider provider) {
    if (provider.loading && provider.items.isEmpty) {
      return const LoadingState();
    }
    if (provider.error != null) {
      return ErrorState(message: provider.error!, onRetry: () => context.read<ClientNoticesProvider>().load());
    }
    if (provider.items.isEmpty) {
      return const EmptyState(message: 'No hay clientes por avisar.');
    }
    return TableScroll(
      child: DataTable(
        columns: const [
          DataColumn(label: Text('Motivo')),
          DataColumn(label: Text('Cliente')),
          DataColumn(label: Text('Teléfono')),
          DataColumn(label: Text('Vehículo')),
          DataColumn(label: Text('Detalle')),
          DataColumn(label: Text('Fecha')),
          DataColumn(label: Text('Acción')),
        ],
        rows: [
          for (final notice in provider.items)
            DataRow(
              cells: [
                DataCell(Text(notice.reason.label)),
                DataCell(CellText(notice.clientName, maxWidth: AppSizes.cellNarrow)),
                DataCell(Text(notice.phone)),
                DataCell(CellText(notice.vehicleLabel, maxWidth: AppSizes.cellWide)),
                DataCell(CellText(notice.detail, maxWidth: AppSizes.cellWide)),
                DataCell(Text(notice.date == null ? '—' : formatDateTime(notice.date!))),
                DataCell(
                  OutlinedButton.icon(
                    onPressed: () => _markNotified(notice),
                    icon: const Icon(LucideIcons.check, size: AppSizes.icon),
                    label: const Text('Marcar como avisado'),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

/// Pide la nota opcional. Devuelve el texto (vacío si no se escribió) al confirmar y `null` al cancelar.
class _NoteDialog extends StatefulWidget {
  const _NoteDialog({required this.clientName});

  final String clientName;

  @override
  State<_NoteDialog> createState() => _NoteDialogState();
}

class _NoteDialogState extends State<_NoteDialog> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Marcar como avisado'),
      content: SizedBox(
        width: AppSizes.dialogWidth,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('¿Ya avisaste a ${widget.clientName}?'),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _controller,
              maxLength: 255,
              decoration: const InputDecoration(labelText: 'Nota (opcional)', hintText: 'Por ejemplo: no contestó'),
            ),
          ],
        ),
      ),
      actions: [
        OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
        FilledButton(onPressed: () => Navigator.of(context).pop(_controller.text), child: const Text('Confirmar')),
      ],
    );
  }
}
