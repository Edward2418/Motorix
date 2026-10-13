import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/appointment.dart';
import '../models/client.dart';
import '../models/vehicle.dart';
import '../providers/appointments_provider.dart';
import '../providers/orders_provider.dart';
import '../services/api_client.dart';
import '../utils/app_tokens.dart';
import '../utils/formatters.dart';
import '../widgets/client_picker.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/section_navigator.dart';

/// Formulario de alta y edición de citas. Al editar, el cliente y el vehículo no cambian.
/// Al guardar cierra devolviendo `true`.
class AppointmentFormScreen extends StatefulWidget {
  const AppointmentFormScreen({super.key, this.appointment});

  final Appointment? appointment;

  @override
  State<AppointmentFormScreen> createState() => _AppointmentFormScreenState();
}

class _AppointmentFormScreenState extends State<AppointmentFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _clientText = TextEditingController(text: widget.appointment?.clientName ?? '');
  late final TextEditingController _dateText = TextEditingController(
    text: widget.appointment == null ? '' : formatDateTime(widget.appointment!.scheduledAt),
  );
  late final TextEditingController _reason = TextEditingController(text: widget.appointment?.reason ?? '');
  late final TextEditingController _notes = TextEditingController(text: widget.appointment?.notes ?? '');

  Client? _client;
  int? _vehicleId;
  List<Vehicle> _vehicles = const [];
  late DateTime? _scheduledAt = widget.appointment?.scheduledAt;

  bool _saving = false;
  bool _saved = false;
  String? _generalError;
  Map<String, String> _serverErrors = const {};

  bool get _editing => widget.appointment != null;

  bool get _dirty {
    if (_saved) {
      return false;
    }
    final original = widget.appointment;
    if (original != null) {
      return _scheduledAt != original.scheduledAt || _reason.text != original.reason || _notes.text != (original.notes ?? '');
    }
    return [_clientText, _dateText, _reason, _notes].any((controller) => controller.text.isNotEmpty);
  }

  @override
  void dispose() {
    for (final controller in [_clientText, _dateText, _reason, _notes]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _onClientSelected(Client client) async {
    setState(() {
      _client = client;
      _vehicleId = null;
      _vehicles = const [];
    });
    try {
      final vehicles = await context.read<OrdersProvider>().vehiclesOf(client.id);
      if (mounted && _client?.id == client.id) {
        setState(() => _vehicles = vehicles);
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _generalError = e.message);
      }
    }
  }

  Future<void> _pickDateTime() async {
    final now = DateTime.now();
    final initial = _scheduledAt ?? now.add(const Duration(days: 1));
    final date = await showDatePicker(
      context: context,
      initialDate: initial.isBefore(now) ? now : initial,
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: DateTime(now.year + 2, now.month, now.day),
    );
    if (date == null || !mounted) {
      return;
    }
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(initial),
    );
    if (time == null || !mounted) {
      return;
    }
    final chosen = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    setState(() {
      _scheduledAt = chosen;
      _dateText.text = formatDateTime(chosen);
    });
  }

  Future<void> _confirmExit() async {
    final leave = await showConfirmDialog(
      context,
      message: '¿Seguro que quieres salir? Los cambios sin guardar se perderán.',
    );
    if (leave && mounted) {
      Navigator.of(context).pop();
    }
  }

  Future<void> _submit() async {
    setState(() {
      _generalError = null;
      _serverErrors = const {};
    });
    if (!_formKey.currentState!.validate()) {
      return;
    }
    setState(() => _saving = true);
    final appointments = context.read<AppointmentsProvider>();
    try {
      if (_editing) {
        await appointments.update(
          widget.appointment!.id,
          scheduledAt: _scheduledAt!,
          reason: _reason.text.trim(),
          notes: _notes.text.trim(),
        );
      } else {
        await appointments.create(
          clientId: _client!.id,
          vehicleId: _vehicleId!,
          scheduledAt: _scheduledAt!,
          reason: _reason.text.trim(),
          notes: _notes.text.trim(),
        );
      }
      if (!mounted) {
        return;
      }
      _saved = true;
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _saving = false;
        _serverErrors = e.fieldErrors;
        _generalError = e.fieldErrors.isEmpty ? e.message : null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final orders = context.read<OrdersProvider>();
    return PopScope(
      // La decisión se toma al intentar salir, porque los campos cambian sin reconstruir el widget.
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) {
          return;
        }
        if (_dirty) {
          _confirmExit();
        } else {
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(_editing ? 'Modificar cita' : 'Registrar cita'),
          backgroundColor: AppColors.surface,
          scrolledUnderElevation: 0,
        ),
        body: PagePadding(
          child: SingleChildScrollView(
            child: Align(
              alignment: Alignment.topLeft,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: AppSizes.formMaxWidth),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpacing.xl),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          ClientPickerField(
                            controller: _clientText,
                            label: 'Cliente',
                            emptyError: 'Elige al cliente de la cita.',
                            search: orders.searchClients,
                            locked: _editing,
                            enabled: !_saving,
                            serverError: _serverErrors['clientId'],
                            selected: _client,
                            onSelected: _onClientSelected,
                            onCleared: () => setState(() {
                              _client = null;
                              _vehicleId = null;
                              _vehicles = const [];
                            }),
                          ),
                          const SizedBox(height: AppSpacing.lg),
                          if (_editing)
                            TextFormField(
                              initialValue: widget.appointment!.vehicleLabel,
                              enabled: false,
                              decoration: const InputDecoration(labelText: 'Vehículo'),
                            )
                          else
                            DropdownButtonFormField<int>(
                              key: ValueKey('vehiculo-${_client?.id}-${_vehicles.length}'),
                              initialValue: _vehicleId,
                              decoration: InputDecoration(
                                labelText: 'Vehículo',
                                helperText: _client != null && _vehicles.isEmpty
                                    ? 'Este cliente no tiene vehículos activos. Regístralo primero.'
                                    : null,
                                errorText: _serverErrors['vehicleId'],
                              ),
                              items: [
                                for (final vehicle in _vehicles)
                                  DropdownMenuItem(
                                    value: vehicle.id,
                                    child: Text('${vehicle.licensePlate} · ${vehicle.description}'),
                                  ),
                              ],
                              onChanged: _saving ? null : (id) => setState(() => _vehicleId = id),
                              validator: (_) => _vehicleId == null ? 'Elige el vehículo.' : null,
                            ),
                          const SizedBox(height: AppSpacing.lg),
                          TextFormField(
                            controller: _dateText,
                            readOnly: true,
                            enabled: !_saving,
                            onTap: _pickDateTime,
                            decoration: InputDecoration(
                              labelText: 'Fecha y hora',
                              suffixIcon: const Icon(LucideIcons.calendarClock, size: AppSizes.icon),
                              errorText: _serverErrors['scheduledAt'],
                            ),
                            validator: (_) {
                              final chosen = _scheduledAt;
                              if (chosen == null) {
                                return 'Elige la fecha y la hora de la cita.';
                              }
                              if (chosen.isBefore(DateTime.now().subtract(const Duration(minutes: 5)))) {
                                return 'La fecha y hora no pueden ser anteriores al momento actual.';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: AppSpacing.lg),
                          TextFormField(
                            controller: _reason,
                            enabled: !_saving,
                            decoration: InputDecoration(labelText: 'Motivo', errorText: _serverErrors['reason']),
                            validator: (value) {
                              final text = value?.trim() ?? '';
                              if (text.isEmpty) {
                                return 'El motivo es obligatorio.';
                              }
                              return text.length > 255 ? 'El motivo no puede tener más de 255 caracteres.' : null;
                            },
                          ),
                          const SizedBox(height: AppSpacing.lg),
                          TextFormField(
                            controller: _notes,
                            enabled: !_saving,
                            minLines: 2,
                            maxLines: 4,
                            decoration: InputDecoration(
                              labelText: 'Observaciones (opcional)',
                              alignLabelWithHint: true,
                              errorText: _serverErrors['notes'],
                            ),
                            validator: (value) =>
                                (value?.trim().length ?? 0) > 1000 ? 'Las observaciones no pueden tener más de 1000 caracteres.' : null,
                          ),
                          if (_generalError != null) ...[
                            const SizedBox(height: AppSpacing.lg),
                            Text(_generalError!, style: const TextStyle(color: AppColors.danger)),
                          ],
                          const SizedBox(height: AppSpacing.xl),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              OutlinedButton(
                                onPressed: _saving ? null : () => Navigator.of(context).maybePop(),
                                child: const Text('Cancelar'),
                              ),
                              const SizedBox(width: AppSpacing.md),
                              FilledButton(
                                onPressed: _saving ? null : _submit,
                                child: Text(_saving ? 'Guardando…' : (_editing ? 'Guardar cambios' : 'Registrar cita')),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
