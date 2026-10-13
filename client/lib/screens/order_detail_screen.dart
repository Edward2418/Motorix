import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/service_order.dart';
import '../models/user.dart';
import '../providers/auth_provider.dart';
import '../providers/orders_provider.dart';
import '../services/api_client.dart';
import '../utils/app_tokens.dart';
import '../utils/formatters.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/order_line_dialog.dart';
import '../widgets/section_navigator.dart';
import '../widgets/status_badge.dart';
import '../widgets/view_states.dart';

/// Detalle de una orden de servicio: datos generales, contenido técnico editable (según rol, propiedad
/// y estado) y, más adelante, las acciones de estado.
class OrderDetailScreen extends StatefulWidget {
  const OrderDetailScreen({super.key, required this.orderId});

  final int orderId;

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  ServiceOrder? _order;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = _order == null;
      _error = null;
    });
    try {
      final order = await context.read<OrdersProvider>().fetchOrder(widget.orderId);
      if (mounted) {
        setState(() => _order = order);
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

  /// Ejecuta una acción que devuelve la orden actualizada y muestra el resultado o el error del servidor.
  Future<void> _run(Future<ServiceOrder> Function(OrdersProvider orders) action, String success) async {
    try {
      final order = await action(context.read<OrdersProvider>());
      if (!mounted) {
        return;
      }
      setState(() => _order = order);
      showFeedback(context, success);
    } on ApiException catch (e) {
      if (mounted) {
        showFeedback(context, e.message, error: true);
      }
    }
  }

  Future<void> _reassign() async {
    final order = _order!;
    final orders = context.read<OrdersProvider>();
    final changed = await showDialog<ServiceOrder>(
      context: context,
      builder: (_) => _ReassignDialog(order: order, orders: orders),
    );
    if (changed != null && mounted) {
      setState(() => _order = changed);
      showFeedback(context, 'Mecánico reasignado correctamente.');
    }
  }

  Future<void> _editText({
    required String field,
    required String title,
    required String? current,
    bool required = false,
    int maxLength = 4000,
  }) async {
    final result = await showDialog<String>(
      context: context,
      builder: (_) => _TextEditDialog(title: title, initial: current ?? '', required: required, maxLength: maxLength),
    );
    if (result == null || !mounted) {
      return;
    }
    await _run(
      (orders) => orders.updateContent(_order!.id, {field: result.isEmpty ? null : result}),
      'Cambios guardados correctamente.',
    );
  }

  Future<void> _addLine(LineKind kind) async {
    final input = await showOrderLineDialog(
      context,
      title: kind == LineKind.services ? 'Agregar servicio' : 'Agregar mano de obra',
    );
    if (input == null || !mounted) {
      return;
    }
    await _run(
      (orders) => orders.addLine(kind, _order!.id, description: input.description, amount: input.amount),
      'Se agregó el ${kind.label}.',
    );
  }

  Future<void> _editLine(LineKind kind, OrderLine line) async {
    final input = await showOrderLineDialog(
      context,
      title: kind == LineKind.services ? 'Editar servicio' : 'Editar mano de obra',
      initial: line,
    );
    if (input == null || !mounted) {
      return;
    }
    await _run(
      (orders) => orders.updateLine(kind, _order!.id, line.id, description: input.description, amount: input.amount),
      'Se actualizó el ${kind.label}.',
    );
  }

  Future<void> _removeLine(LineKind kind, OrderLine line) async {
    final confirmed = await showConfirmDialog(
      context,
      message: '¿Seguro que quieres quitar «${line.description}» de la orden?',
    );
    if (!confirmed || !mounted) {
      return;
    }
    await _run((orders) => orders.removeLine(kind, _order!.id, line.id), 'Se quitó el ${kind.label}.');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_order == null ? 'Orden de servicio' : 'Orden ${_order!.folio}'),
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
    final order = _order!;
    final user = context.select<AuthProvider, ({int? id, UserRole? role})>(
      (auth) => (id: auth.user?.id, role: auth.user?.role),
    );
    final canManage = user.role == UserRole.admin || user.role == UserRole.receptionist;
    final assigned = user.role == UserRole.mechanic && order.mechanicId == user.id;
    final canEditTechnical = user.role == UserRole.admin || assigned;
    final status = order.status;

    // Qué se puede editar en cada estado (FR-017a); el servidor vuelve a validarlo.
    final open = !status.isFinal && status != OrderStatus.finished;
    final canEditProblem = canManage && open;
    final canEditDiagnosis = canEditTechnical && open;
    final canEditLines = canEditTechnical && open;
    final canEditNotes = canEditTechnical && !status.isFinal;
    final theme = Theme.of(context);

    return PagePadding(
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildSummary(context, order, canManage),
            _TextSection(
              title: 'Problema reportado',
              text: order.reportedProblem,
              emptyText: 'Sin problema reportado.',
              editLabel: 'Editar problema reportado',
              onEdit: canEditProblem
                  ? () => _editText(
                        field: 'reportedProblem',
                        title: 'Editar problema reportado',
                        current: order.reportedProblem,
                        required: true,
                        maxLength: 2000,
                      )
                  : null,
            ),
            _TextSection(
              title: 'Diagnóstico',
              text: order.diagnosis,
              emptyText: 'Todavía no se registra un diagnóstico.',
              editLabel: 'Editar diagnóstico',
              onEdit: canEditDiagnosis
                  ? () => _editText(field: 'diagnosis', title: 'Editar diagnóstico', current: order.diagnosis)
                  : null,
            ),
            _LinesSection(
              title: 'Servicios realizados',
              addLabel: 'Agregar servicio',
              emptyText: 'Todavía no hay servicios registrados.',
              lines: order.services,
              subtotal: order.servicesTotal,
              canEdit: canEditLines,
              onAdd: () => _addLine(LineKind.services),
              onEdit: (line) => _editLine(LineKind.services, line),
              onRemove: (line) => _removeLine(LineKind.services, line),
            ),
            _LinesSection(
              title: 'Mano de obra',
              addLabel: 'Agregar mano de obra',
              emptyText: 'Todavía no hay mano de obra registrada.',
              lines: order.labor,
              subtotal: order.laborTotal,
              canEdit: canEditLines,
              onAdd: () => _addLine(LineKind.labor),
              onEdit: (line) => _editLine(LineKind.labor, line),
              onRemove: (line) => _removeLine(LineKind.labor, line),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xl),
              child: Align(
                alignment: Alignment.centerRight,
                child: Text('Total: ${formatMoney(order.total)}', style: theme.textTheme.titleLarge),
              ),
            ),
            _TextSection(
              title: 'Observaciones',
              text: order.notes,
              emptyText: 'Sin observaciones.',
              editLabel: 'Editar observaciones',
              onEdit: canEditNotes
                  ? () => _editText(field: 'notes', title: 'Editar observaciones', current: order.notes)
                  : null,
            ),
            _TextSection(
              title: 'Recomendaciones',
              text: order.recommendations,
              emptyText: 'Sin recomendaciones.',
              editLabel: 'Editar recomendaciones',
              onEdit: canEditNotes
                  ? () => _editText(field: 'recommendations', title: 'Editar recomendaciones', current: order.recommendations)
                  : null,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummary(BuildContext context, ServiceOrder order, bool canManage) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xl),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: AppSpacing.xxl,
                runSpacing: AppSpacing.lg,
                children: [
                  _Field(label: 'Folio', value: order.folio),
                  _Field(label: 'Estado', child: StatusBadge.order(order.status)),
                  _Field(label: 'Cliente', value: order.clientName),
                  _Field(label: 'Vehículo', value: order.vehicleLabel),
                  _Field(label: 'Mecánico asignado', value: order.mechanicName),
                  _Field(label: 'Kilometraje de entrada', value: formatMileage(order.entryMileage)),
                  _Field(label: 'Recibida', value: formatDateTime(order.createdAt)),
                  if (order.deliveredAt != null) _Field(label: 'Entregada', value: formatDateTime(order.deliveredAt!)),
                ],
              ),
              if (order.mileageCorrectionReason != null) ...[
                const SizedBox(height: AppSpacing.lg),
                Text(
                  'Kilometraje corregido (antes ${formatMileage(order.previousMileage ?? 0)}): '
                  '${order.mileageCorrectionReason}',
                  style: theme.textTheme.bodySmall,
                ),
              ],
              if (order.cancelReason != null) ...[
                const SizedBox(height: AppSpacing.lg),
                Text('Motivo de cancelación: ${order.cancelReason}',
                    style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.danger)),
              ],
              if (canManage && !order.status.isFinal) ...[
                const SizedBox(height: AppSpacing.lg),
                OutlinedButton.icon(
                  onPressed: _reassign,
                  icon: const Icon(LucideIcons.userCog, size: AppSizes.icon),
                  label: const Text('Reasignar mecánico'),
                ),
              ],
            ],
          ),
        ),
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

/// Sección con título, contenido y, si el usuario puede editar, el botón de edición.
class _SectionFrame extends StatelessWidget {
  const _SectionFrame({required this.title, required this.child, this.action});

  final String title;
  final Widget child;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Text(title, style: Theme.of(context).textTheme.titleLarge),
              const Spacer(),
              ?action,
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Card(clipBehavior: Clip.antiAlias, child: child),
        ],
      ),
    );
  }
}

class _TextSection extends StatelessWidget {
  const _TextSection({
    required this.title,
    required this.text,
    required this.emptyText,
    required this.editLabel,
    required this.onEdit,
  });

  final String title;
  final String? text;
  final String emptyText;
  final String editLabel;
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final empty = text == null || text!.isEmpty;
    return _SectionFrame(
      title: title,
      action: onEdit == null
          ? null
          : OutlinedButton.icon(
              onPressed: onEdit,
              icon: const Icon(LucideIcons.pencil, size: AppSizes.icon),
              label: Text(editLabel),
            ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: SelectableText(
          empty ? emptyText : text!,
          style: empty
              ? theme.textTheme.bodyMedium?.copyWith(color: AppColors.textSecondary)
              : theme.textTheme.bodyLarge,
        ),
      ),
    );
  }
}

class _LinesSection extends StatelessWidget {
  const _LinesSection({
    required this.title,
    required this.addLabel,
    required this.emptyText,
    required this.lines,
    required this.subtotal,
    required this.canEdit,
    required this.onAdd,
    required this.onEdit,
    required this.onRemove,
  });

  final String title;
  final String addLabel;
  final String emptyText;
  final List<OrderLine> lines;
  final double subtotal;
  final bool canEdit;
  final VoidCallback onAdd;
  final void Function(OrderLine line) onEdit;
  final void Function(OrderLine line) onRemove;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return _SectionFrame(
      title: title,
      action: canEdit
          ? OutlinedButton.icon(
              onPressed: onAdd,
              icon: const Icon(LucideIcons.plus, size: AppSizes.icon),
              label: Text(addLabel),
            )
          : null,
      child: lines.isEmpty
          ? Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Text(emptyText, style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.textSecondary)),
            )
          : Column(
              children: [
                for (final line in lines) ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl, vertical: AppSpacing.sm),
                    child: Row(
                      children: [
                        Expanded(child: Text(line.description, style: theme.textTheme.bodyLarge)),
                        Text(formatMoney(line.amount), style: theme.textTheme.bodyLarge),
                        if (canEdit) ...[
                          IconButton(
                            tooltip: 'Editar ${line.description}',
                            onPressed: () => onEdit(line),
                            icon: const Icon(LucideIcons.pencil, size: AppSizes.icon),
                          ),
                          IconButton(
                            tooltip: 'Quitar ${line.description}',
                            onPressed: () => onRemove(line),
                            icon: const Icon(LucideIcons.trash2, size: AppSizes.icon),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const Divider(),
                ],
                Padding(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  child: Align(
                    alignment: Alignment.centerRight,
                    child: Text('Subtotal: ${formatMoney(subtotal)}', style: theme.textTheme.titleMedium),
                  ),
                ),
              ],
            ),
    );
  }
}

/// Diálogo para editar un texto largo. Un texto vacío se guarda como «sin contenido», salvo que sea obligatorio.
class _TextEditDialog extends StatefulWidget {
  const _TextEditDialog({required this.title, required this.initial, required this.required, required this.maxLength});

  final String title;
  final String initial;
  final bool required;
  final int maxLength;

  @override
  State<_TextEditDialog> createState() => _TextEditDialogState();
}

class _TextEditDialogState extends State<_TextEditDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _controller = TextEditingController(text: widget.initial);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _save() {
    if (_formKey.currentState!.validate()) {
      Navigator.of(context).pop(_controller.text.trim());
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: SizedBox(
        width: AppSizes.formMaxWidth,
        child: Form(
          key: _formKey,
          child: TextFormField(
            controller: _controller,
            autofocus: true,
            minLines: 4,
            maxLines: 10,
            decoration: const InputDecoration(alignLabelWithHint: true, labelText: 'Texto'),
            validator: (value) {
              final text = value?.trim() ?? '';
              if (widget.required && text.isEmpty) {
                return 'Este campo es obligatorio.';
              }
              return text.length > widget.maxLength ? 'No puede tener más de ${widget.maxLength} caracteres.' : null;
            },
          ),
        ),
      ),
      actions: [
        OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
        FilledButton(onPressed: _save, child: const Text('Guardar')),
      ],
    );
  }
}

class _ReassignDialog extends StatefulWidget {
  const _ReassignDialog({required this.order, required this.orders});

  final ServiceOrder order;
  final OrdersProvider orders;

  @override
  State<_ReassignDialog> createState() => _ReassignDialogState();
}

class _ReassignDialogState extends State<_ReassignDialog> {
  List<MechanicOption> _mechanics = const [];
  int? _selected;
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final mechanics = await widget.orders.fetchMechanics();
      if (mounted) {
        setState(() {
          _mechanics = mechanics;
          _selected = mechanics.any((m) => m.id == widget.order.mechanicId) ? widget.order.mechanicId : null;
          _loading = false;
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          _loading = false;
        });
      }
    }
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final order = await widget.orders.reassignMechanic(widget.order.id, _selected!);
      if (mounted) {
        Navigator.of(context).pop(order);
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = e.message;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Reasignar mecánico'),
      content: SizedBox(
        width: AppSizes.dialogWidth,
        child: _loading
            ? const LoadingState()
            : Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  DropdownButtonFormField<int>(
                    initialValue: _selected,
                    decoration: const InputDecoration(labelText: 'Mecánico'),
                    items: [
                      for (final mechanic in _mechanics)
                        DropdownMenuItem(
                          value: mechanic.id,
                          child: Text('${mechanic.name} (${mechanic.openOrders} abiertas)'),
                        ),
                    ],
                    onChanged: _saving ? null : (id) => setState(() => _selected = id),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: AppSpacing.lg),
                    Text(_error!, style: const TextStyle(color: AppColors.danger)),
                  ],
                ],
              ),
      ),
      actions: [
        OutlinedButton(
          onPressed: _saving ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: _saving || _selected == null || _selected == widget.order.mechanicId ? null : _save,
          child: Text(_saving ? 'Guardando…' : 'Reasignar'),
        ),
      ],
    );
  }
}
