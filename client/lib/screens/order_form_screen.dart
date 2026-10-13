import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/client.dart';
import '../models/service_order.dart';
import '../models/user.dart';
import '../models/vehicle.dart';
import '../providers/auth_provider.dart';
import '../providers/orders_provider.dart';
import '../services/api_client.dart';
import '../utils/app_tokens.dart';
import '../utils/formatters.dart';
import '../widgets/client_picker.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/section_navigator.dart';

/// Formulario de alta de una orden de servicio. Al guardar cierra devolviendo la [ServiceOrder] creada.
/// Si llega de una cita ([appointmentId]), el cliente queda fijo y el vehículo viene preseleccionado.
class OrderFormScreen extends StatefulWidget {
  const OrderFormScreen({super.key, this.initialClient, this.initialVehicle, this.appointmentId});

  final Client? initialClient;
  final Vehicle? initialVehicle;
  final int? appointmentId;

  @override
  State<OrderFormScreen> createState() => _OrderFormScreenState();
}

class _OrderFormScreenState extends State<OrderFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _clientText = TextEditingController();
  final _mileage = TextEditingController();
  final _problem = TextEditingController();
  final _correctionReason = TextEditingController();

  Client? _client;
  Vehicle? _vehicle;
  int? _mechanicId;
  bool _correctMileage = false;

  List<Vehicle> _vehicles = const [];
  List<MechanicOption> _mechanics = const [];
  bool _loadingOptions = true;
  String? _loadError;

  bool _saving = false;
  bool _saved = false;
  String? _generalError;
  Map<String, String> _serverErrors = const {};

  bool get _isAdmin => context.read<AuthProvider>().user?.role == UserRole.admin;

  bool get _dirty =>
      !_saved && [_mileage, _problem, _correctionReason, _clientText].any((controller) => controller.text.isNotEmpty);

  @override
  void initState() {
    super.initState();
    _client = widget.initialClient;
    _vehicle = widget.initialVehicle;
    _clientText.text = widget.initialClient?.name ?? '';
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadOptions());
  }

  @override
  void dispose() {
    for (final controller in [_clientText, _mileage, _problem, _correctionReason]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _loadOptions() async {
    final orders = context.read<OrdersProvider>();
    try {
      final mechanics = await orders.fetchMechanics();
      final vehicles = _client == null ? const <Vehicle>[] : await orders.vehiclesOf(_client!.id);
      if (!mounted) {
        return;
      }
      setState(() {
        _mechanics = mechanics;
        _vehicles = vehicles;
        _vehicle = _vehicle == null ? null : vehicles.where((v) => v.id == _vehicle!.id).firstOrNull ?? _vehicle;
        _loadingOptions = false;
      });
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _loadError = e.message;
          _loadingOptions = false;
        });
      }
    }
  }

  Future<void> _onClientSelected(Client client) async {
    setState(() {
      _client = client;
      _vehicle = null;
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
    try {
      final order = await context.read<OrdersProvider>().createOrder(
            clientId: _client!.id,
            vehicleId: _vehicle!.id,
            mechanicId: _mechanicId!,
            entryMileage: int.parse(_mileage.text.trim()),
            reportedProblem: _problem.text.trim(),
            appointmentId: widget.appointmentId,
            correctMileage: _correctMileage,
            mileageCorrectionReason: _correctMileage ? _correctionReason.text.trim() : null,
          );
      if (!mounted) {
        return;
      }
      _saved = true;
      Navigator.of(context).pop(order);
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

  String? _validateMileage(String? value) {
    final text = value?.trim() ?? '';
    final km = int.tryParse(text);
    if (km == null || km < 0) {
      return 'Ingresa un kilometraje entero mayor o igual a 0.';
    }
    final registered = _vehicle?.currentMileage;
    if (registered != null && km < registered && !_correctMileage) {
      return 'No puede ser menor al registrado (${formatMileage(registered)}).'
          '${_isAdmin ? ' Marca «Corregir kilometraje» si es un error.' : ''}';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final lockClient = widget.appointmentId != null;
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
          title: const Text('Crear orden de servicio'),
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
                    child: _loadError != null
                        ? Text(_loadError!, style: const TextStyle(color: AppColors.danger))
                        : Form(
                            key: _formKey,
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                ClientPickerField(
                                  controller: _clientText,
                                  label: 'Cliente',
                                  emptyError: 'Elige al cliente de la orden.',
                                  search: orders.searchClients,
                                  locked: lockClient,
                                  enabled: !_saving,
                                  serverError: _serverErrors['clientId'],
                                  selected: _client,
                                  onSelected: _onClientSelected,
                                  onCleared: () => setState(() {
                                    _client = null;
                                    _vehicle = null;
                                    _vehicles = const [];
                                  }),
                                ),
                                const SizedBox(height: AppSpacing.lg),
                                DropdownButtonFormField<int>(
                                  key: ValueKey('vehiculo-${_client?.id}-${_vehicles.length}'),
                                  initialValue: _vehicles.any((v) => v.id == _vehicle?.id) ? _vehicle?.id : null,
                                  decoration: InputDecoration(
                                    labelText: 'Vehículo',
                                    helperText: _client != null && _vehicles.isEmpty
                                        ? 'Este cliente no tiene vehículos activos. Regístralo primero.'
                                        : null,
                                    errorText: _serverErrors['vehicleId'],
                                  ),
                                  items: [
                                    for (final vehicle in _vehicles)
                                      DropdownMenuItem(value: vehicle.id, child: Text('${vehicle.licensePlate} · ${vehicle.description}')),
                                  ],
                                  onChanged: _saving || lockClient && widget.initialVehicle != null
                                      ? null
                                      : (id) => setState(() => _vehicle = _vehicles.firstWhere((v) => v.id == id)),
                                  validator: (_) => _vehicle == null ? 'Elige el vehículo.' : null,
                                ),
                                const SizedBox(height: AppSpacing.lg),
                                DropdownButtonFormField<int>(
                                  key: ValueKey('mecanico-${_mechanics.length}'),
                                  initialValue: _mechanicId,
                                  decoration: InputDecoration(
                                    labelText: 'Mecánico asignado',
                                    helperText: _loadingOptions ? 'Cargando mecánicos…' : null,
                                    errorText: _serverErrors['mechanicId'],
                                  ),
                                  items: [
                                    for (final mechanic in _mechanics)
                                      DropdownMenuItem(
                                        value: mechanic.id,
                                        child: Text('${mechanic.name} (${mechanic.openOrders} abiertas)'),
                                      ),
                                  ],
                                  onChanged: _saving ? null : (id) => setState(() => _mechanicId = id),
                                  validator: (_) => _mechanicId == null ? 'Elige al mecánico.' : null,
                                ),
                                const SizedBox(height: AppSpacing.lg),
                                TextFormField(
                                  controller: _mileage,
                                  enabled: !_saving,
                                  keyboardType: TextInputType.number,
                                  decoration: InputDecoration(
                                    labelText: 'Kilometraje de entrada',
                                    helperText: _vehicle == null
                                        ? null
                                        : 'Kilometraje registrado: ${formatMileage(_vehicle!.currentMileage)}',
                                    errorText: _serverErrors['entryMileage'],
                                    errorMaxLines: 3,
                                  ),
                                  validator: _validateMileage,
                                ),
                                if (_isAdmin) ...[
                                  const SizedBox(height: AppSpacing.sm),
                                  CheckboxListTile(
                                    contentPadding: EdgeInsets.zero,
                                    controlAffinity: ListTileControlAffinity.leading,
                                    value: _correctMileage,
                                    onChanged: _saving ? null : (value) => setState(() => _correctMileage = value ?? false),
                                    title: const Text('Corregir kilometraje'),
                                    subtitle: const Text('Permite un kilometraje menor al registrado y exige un motivo.'),
                                  ),
                                  if (_correctMileage)
                                    TextFormField(
                                      controller: _correctionReason,
                                      enabled: !_saving,
                                      decoration: InputDecoration(
                                        labelText: 'Motivo de la corrección',
                                        errorText: _serverErrors['mileageCorrectionReason'],
                                      ),
                                      validator: (value) => (value == null || value.trim().isEmpty)
                                          ? 'Indica el motivo de la corrección.'
                                          : null,
                                    ),
                                ],
                                const SizedBox(height: AppSpacing.lg),
                                TextFormField(
                                  controller: _problem,
                                  enabled: !_saving,
                                  minLines: 3,
                                  maxLines: 6,
                                  decoration: InputDecoration(
                                    labelText: 'Problema reportado',
                                    alignLabelWithHint: true,
                                    errorText: _serverErrors['reportedProblem'],
                                  ),
                                  validator: (value) {
                                    final text = value?.trim() ?? '';
                                    if (text.isEmpty) {
                                      return 'El problema reportado es obligatorio.';
                                    }
                                    return text.length > 2000 ? 'No puede tener más de 2000 caracteres.' : null;
                                  },
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
                                      child: Text(_saving ? 'Guardando…' : 'Crear orden'),
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
