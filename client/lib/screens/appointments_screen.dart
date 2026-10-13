import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/appointment.dart';
import '../models/client.dart';
import '../models/service_order.dart';
import '../models/vehicle.dart';
import '../providers/appointments_provider.dart';
import '../providers/orders_provider.dart';
import '../services/api_client.dart';
import '../utils/app_tokens.dart';
import '../utils/formatters.dart';
import '../widgets/client_picker.dart';
import '../widgets/cell_text.dart';
import '../widgets/section_navigator.dart';
import '../widgets/status_badge.dart';
import '../widgets/table_footer.dart';
import '../widgets/table_scroll.dart';
import '../widgets/view_states.dart';
import 'appointment_form_screen.dart';
import 'order_detail_screen.dart';
import 'order_form_screen.dart';

/// Citas del taller (solo ADMIN y RECEPTIONIST): listado con filtros, alta, edición, confirmación,
/// cancelación y creación de la orden de servicio a partir de la cita.
class AppointmentsScreen extends StatefulWidget {
  const AppointmentsScreen({super.key});

  @override
  State<AppointmentsScreen> createState() => _AppointmentsScreenState();
}

class _AppointmentsScreenState extends State<AppointmentsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<AppointmentsProvider>().load());
  }

  Future<void> _openForm([Appointment? appointment]) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => AppointmentFormScreen(appointment: appointment)),
    );
    if (saved == true && mounted) {
      showFeedback(context, appointment == null ? 'Cita registrada correctamente.' : 'Cita actualizada correctamente.');
    }
  }

  /// Ejecuta una acción sobre la cita y muestra el resultado o el error del servidor.
  Future<void> _run(Future<void> Function(AppointmentsProvider appointments) action, String success) async {
    try {
      await action(context.read<AppointmentsProvider>());
      if (mounted) {
        showFeedback(context, success);
      }
    } on ApiException catch (e) {
      if (mounted) {
        showFeedback(context, e.message, error: true);
      }
    }
  }

  Future<void> _confirm(Appointment appointment) =>
      _run((appointments) => appointments.confirm(appointment.id), 'Cita confirmada.');

  Future<void> _cancel(Appointment appointment) async {
    final reason = await showDialog<String>(
      context: context,
      builder: (_) => _CancelAppointmentDialog(appointment: appointment),
    );
    if (reason == null || !mounted) {
      return;
    }
    await _run((appointments) => appointments.cancel(appointment.id, reason: reason), 'Cita cancelada.');
  }

  /// Abre el formulario de la orden con el cliente, el vehículo y la cita ya fijados.
  Future<void> _createOrder(Appointment appointment) async {
    final client = Client(
      id: appointment.clientId,
      name: appointment.clientName,
      phone: '',
      email: null,
      active: true,
      vehicleCount: 0,
    );
    // El formulario carga el vehículo completo a partir de este identificador.
    final vehicle = Vehicle(
      id: appointment.vehicleId,
      clientId: appointment.clientId,
      clientName: appointment.clientName,
      brand: '',
      model: '',
      year: 0,
      licensePlate: appointment.vehicleLabel.split(' · ').first,
      vin: null,
      currentMileage: 0,
      active: true,
    );
    final order = await Navigator.of(context).push<ServiceOrder>(
      MaterialPageRoute(
        builder: (_) => OrderFormScreen(initialClient: client, initialVehicle: vehicle, appointmentId: appointment.id),
      ),
    );
    if (order == null || !mounted) {
      return;
    }
    await context.read<AppointmentsProvider>().load();
    if (!mounted) {
      return;
    }
    showFeedback(context, 'Orden ${order.folio} creada desde la cita.');
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => OrderDetailScreen(orderId: order.id)));
    if (mounted) {
      await context.read<AppointmentsProvider>().load();
    }
  }

  Future<void> _pickDates() async {
    final appointments = context.read<AppointmentsProvider>();
    final now = DateTime.now();
    final range = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 2),
      lastDate: DateTime(now.year + 2, 12, 31),
      initialDateRange: appointments.from != null && appointments.to != null
          ? DateTimeRange(start: appointments.from!, end: appointments.to!)
          : null,
      helpText: 'Filtrar citas por fecha',
      saveText: 'Aplicar',
    );
    if (range != null && mounted) {
      await appointments.setDateRange(range.start, range.end);
    }
  }

  Future<void> _pickClient() async {
    final client = await showDialog<Client>(context: context, builder: (_) => const _ClientFilterDialog());
    if (client != null && mounted) {
      await context.read<AppointmentsProvider>().setClient(client);
    }
  }

  @override
  Widget build(BuildContext context) {
    final appointments = context.watch<AppointmentsProvider>();
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
              OutlinedButton.icon(
                onPressed: _pickDates,
                icon: const Icon(LucideIcons.calendarRange, size: AppSizes.icon),
                label: Text(
                  appointments.from == null || appointments.to == null
                      ? 'Filtrar por fecha'
                      : '${formatDate(appointments.from!)} – ${formatDate(appointments.to!)}',
                ),
              ),
              DropdownButtonHideUnderline(
                child: DropdownButton<AppointmentStatus?>(
                  value: appointments.status,
                  borderRadius: BorderRadius.circular(AppRadius.panel),
                  style: theme.textTheme.bodyMedium,
                  items: [
                    const DropdownMenuItem<AppointmentStatus?>(value: null, child: Text('Todos los estados')),
                    for (final status in AppointmentStatus.values)
                      DropdownMenuItem<AppointmentStatus?>(value: status, child: Text(status.label)),
                  ],
                  onChanged: (value) => context.read<AppointmentsProvider>().setStatus(value),
                ),
              ),
              if (appointments.client == null)
                OutlinedButton.icon(
                  onPressed: _pickClient,
                  icon: const Icon(LucideIcons.user, size: AppSizes.icon),
                  label: const Text('Filtrar por cliente'),
                )
              else
                InputChip(
                  label: Text('Cliente: ${appointments.client!.name}'),
                  onDeleted: () => context.read<AppointmentsProvider>().setClient(null),
                ),
              if (appointments.hasFilters)
                TextButton(
                  onPressed: () => context.read<AppointmentsProvider>().clearFilters(),
                  child: const Text('Quitar filtros'),
                ),
              FilledButton.icon(
                onPressed: () => _openForm(),
                icon: const Icon(LucideIcons.plus, size: AppSizes.icon),
                label: const Text('Registrar cita'),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Expanded(
            child: Card(
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  Expanded(child: _buildBody(context, appointments)),
                  const Divider(),
                  TableFooter(
                    page: appointments.page,
                    pageSize: AppointmentsProvider.pageSize,
                    total: appointments.total,
                    onPageChanged: (page) => context.read<AppointmentsProvider>().goToPage(page),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(BuildContext context, AppointmentsProvider appointments) {
    if (appointments.loading && appointments.items.isEmpty) {
      return const LoadingState();
    }
    if (appointments.error != null) {
      return ErrorState(message: appointments.error!, onRetry: () => context.read<AppointmentsProvider>().load());
    }
    if (appointments.items.isEmpty) {
      return EmptyState(
        message: appointments.hasFilters
            ? 'No se encontraron citas con esos filtros.'
            : 'Todavía no hay citas registradas.',
        actionLabel: appointments.hasFilters ? null : 'Registrar cita',
        onAction: appointments.hasFilters ? null : () => _openForm(),
      );
    }
    return TableScroll(
      child: DataTable(
        columns: const [
          DataColumn(label: Text('Fecha y hora')),
          DataColumn(label: Text('Cliente')),
          DataColumn(label: Text('Vehículo')),
          DataColumn(label: Text('Motivo')),
          DataColumn(label: Text('Estado')),
          DataColumn(label: Text('Orden')),
          DataColumn(label: Text('Acciones')),
        ],
        rows: [
          for (final appointment in appointments.items)
            DataRow(
              cells: [
                DataCell(Text(formatDateTime(appointment.scheduledAt))),
                DataCell(CellText(appointment.clientName, maxWidth: AppSizes.cellNarrow)),
                DataCell(CellText(appointment.vehicleLabel, maxWidth: AppSizes.cellWide)),
                DataCell(CellText(appointment.reason, maxWidth: AppSizes.cellWide)),
                DataCell(StatusBadge.appointment(appointment.status)),
                DataCell(Text(appointment.orderFolio ?? '—')),
                DataCell(_actions(appointment)),
              ],
            ),
        ],
      ),
    );
  }

  Widget _actions(Appointment appointment) {
    final editable = appointment.status.editable;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (appointment.status == AppointmentStatus.pending)
          IconButton(
            tooltip: 'Confirmar cita',
            onPressed: () => _confirm(appointment),
            visualDensity: VisualDensity.compact,
            icon: const Icon(LucideIcons.circleCheck, size: AppSizes.icon),
          ),
        if (editable)
          IconButton(
            tooltip: 'Modificar cita',
            onPressed: () => _openForm(appointment),
            visualDensity: VisualDensity.compact,
            icon: const Icon(LucideIcons.pencil, size: AppSizes.icon),
          ),
        if (editable)
          IconButton(
            tooltip: 'Crear orden',
            onPressed: () => _createOrder(appointment),
            visualDensity: VisualDensity.compact,
            icon: const Icon(LucideIcons.wrench, size: AppSizes.icon),
          ),
        if (editable && appointment.orderId == null)
          IconButton(
            tooltip: 'Cancelar cita',
            onPressed: () => _cancel(appointment),
            visualDensity: VisualDensity.compact,
            icon: const Icon(LucideIcons.ban, size: AppSizes.icon),
          ),
      ],
    );
  }
}

/// Confirma la cancelación de una cita; el motivo es opcional. Devuelve el motivo (puede ir vacío) o `null`.
class _CancelAppointmentDialog extends StatefulWidget {
  const _CancelAppointmentDialog({required this.appointment});

  final Appointment appointment;

  @override
  State<_CancelAppointmentDialog> createState() => _CancelAppointmentDialogState();
}

class _CancelAppointmentDialogState extends State<_CancelAppointmentDialog> {
  final _reason = TextEditingController();

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final appointment = widget.appointment;
    return AlertDialog(
      title: const Text('Cancelar cita'),
      content: SizedBox(
        width: AppSizes.dialogWidth,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '¿Seguro que quieres cancelar la cita de ${appointment.clientName} del '
              '${formatDateTime(appointment.scheduledAt)}? Esta acción no se puede deshacer.',
            ),
            const SizedBox(height: AppSpacing.lg),
            TextField(
              controller: _reason,
              maxLength: 255,
              decoration: const InputDecoration(labelText: 'Motivo (opcional)'),
            ),
          ],
        ),
      ),
      actions: [
        OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
        FilledButton(onPressed: () => Navigator.of(context).pop(_reason.text.trim()), child: const Text('Confirmar')),
      ],
    );
  }
}

/// Elige al cliente para filtrar las citas.
class _ClientFilterDialog extends StatefulWidget {
  const _ClientFilterDialog();

  @override
  State<_ClientFilterDialog> createState() => _ClientFilterDialogState();
}

class _ClientFilterDialogState extends State<_ClientFilterDialog> {
  final _text = TextEditingController();
  Client? _selected;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Filtrar por cliente'),
      content: SizedBox(
        width: AppSizes.dialogWidth,
        child: ClientPickerField(
          controller: _text,
          search: context.read<OrdersProvider>().searchClients,
          selected: _selected,
          onSelected: (client) => setState(() => _selected = client),
          onCleared: () => setState(() => _selected = null),
        ),
      ),
      actions: [
        OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
        FilledButton(
          onPressed: _selected == null ? null : () => Navigator.of(context).pop(_selected),
          child: const Text('Aplicar'),
        ),
      ],
    );
  }
}
