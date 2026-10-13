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
import '../widgets/section_navigator.dart';
import '../widgets/status_badge.dart';
import '../widgets/view_states.dart';

/// Detalle de una orden de servicio: datos generales, problema reportado y, según el rol y el estado,
/// las acciones disponibles.
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

  void _replace(ServiceOrder order) => setState(() => _order = order);

  Future<void> _reassign() async {
    final order = _order!;
    final orders = context.read<OrdersProvider>();
    final changed = await showDialog<ServiceOrder>(
      context: context,
      builder: (_) => _ReassignDialog(order: order, orders: orders),
    );
    if (changed != null && mounted) {
      _replace(changed);
      showFeedback(context, 'Mecánico reasignado correctamente.');
    }
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
    final role = context.select<AuthProvider, UserRole?>((auth) => auth.user?.role);
    final canManage = role == UserRole.admin || role == UserRole.receptionist;
    final theme = Theme.of(context);

    return PagePadding(
      child: SingleChildScrollView(
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
                        _Field(label: 'Folio', value: order.folio),
                        _Field(label: 'Estado', child: StatusBadge.order(order.status)),
                        _Field(label: 'Cliente', value: order.clientName),
                        _Field(label: 'Vehículo', value: order.vehicleLabel),
                        _Field(label: 'Mecánico asignado', value: order.mechanicName),
                        _Field(label: 'Kilometraje de entrada', value: formatMileage(order.entryMileage)),
                        _Field(label: 'Recibida', value: formatDateTime(order.createdAt)),
                        if (order.deliveredAt != null)
                          _Field(label: 'Entregada', value: formatDateTime(order.deliveredAt!)),
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
            const SizedBox(height: AppSpacing.xl),
            Text('Problema reportado', style: theme.textTheme.titleLarge),
            const SizedBox(height: AppSpacing.md),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.xl),
                child: SelectableText(order.reportedProblem, style: theme.textTheme.bodyLarge),
              ),
            ),
          ],
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
