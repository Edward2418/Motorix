import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/client.dart';
import '../providers/vehicles_provider.dart';
import '../services/api_client.dart';
import '../utils/app_tokens.dart';
import '../widgets/client_picker.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/section_navigator.dart';

/// Formulario de alta de vehículo. El propietario es obligatorio: se elige entre los clientes activos
/// o llega preseleccionado desde el detalle del cliente. Al guardar cierra devolviendo `true`.
class VehicleFormScreen extends StatefulWidget {
  const VehicleFormScreen({super.key, this.initialOwner});

  final Client? initialOwner;

  @override
  State<VehicleFormScreen> createState() => _VehicleFormScreenState();
}

class _VehicleFormScreenState extends State<VehicleFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _owner = TextEditingController();
  final _brand = TextEditingController();
  final _model = TextEditingController();
  final _year = TextEditingController();
  final _plate = TextEditingController();
  final _vin = TextEditingController();
  final _mileage = TextEditingController();

  Client? _selectedOwner;
  bool _saving = false;
  bool _saved = false;
  String? _generalError;
  Map<String, String> _serverErrors = const {};

  @override
  void initState() {
    super.initState();
    _selectedOwner = widget.initialOwner;
    _owner.text = widget.initialOwner?.name ?? '';
  }

  bool get _dirty =>
      !_saved &&
      [_brand, _model, _year, _plate, _vin, _mileage].any((controller) => controller.text.isNotEmpty);

  @override
  void dispose() {
    for (final controller in [_owner, _brand, _model, _year, _plate, _vin, _mileage]) {
      controller.dispose();
    }
    super.dispose();
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
      await context.read<VehiclesProvider>().create(
            clientId: _selectedOwner!.id,
            brand: _brand.text.trim(),
            model: _model.text.trim(),
            year: int.parse(_year.text.trim()),
            licensePlate: _plate.text.trim(),
            vin: _vin.text.trim(),
            currentMileage: _mileage.text.trim().isEmpty ? null : int.parse(_mileage.text.trim()),
          );
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

  String? _required(String? value, String label, {required String adjective, int max = 50}) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) {
      return '$label es $adjective.';
    }
    return text.length > max ? '$label no puede tener más de $max caracteres.' : null;
  }

  @override
  Widget build(BuildContext context) {
    final maxYear = DateTime.now().year + 1;
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
          title: const Text('Registrar vehículo'),
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
                            controller: _owner,
                            label: 'Propietario',
                            emptyError: 'Elige al propietario del vehículo.',
                            search: context.read<VehiclesProvider>().searchOwners,
                            locked: widget.initialOwner != null,
                            enabled: !_saving,
                            serverError: _serverErrors['clientId'],
                            selected: _selectedOwner,
                            onSelected: (client) => setState(() => _selectedOwner = client),
                            onCleared: () => setState(() => _selectedOwner = null),
                          ),
                          const SizedBox(height: AppSpacing.lg),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: TextFormField(
                                  controller: _brand,
                                  enabled: !_saving,
                                  decoration: InputDecoration(labelText: 'Marca', errorText: _serverErrors['brand']),
                                  validator: (value) => _required(value, 'La marca', adjective: 'obligatoria'),
                                ),
                              ),
                              const SizedBox(width: AppSpacing.lg),
                              Expanded(
                                child: TextFormField(
                                  controller: _model,
                                  enabled: !_saving,
                                  decoration: InputDecoration(labelText: 'Modelo', errorText: _serverErrors['model']),
                                  validator: (value) => _required(value, 'El modelo', adjective: 'obligatorio'),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.lg),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: TextFormField(
                                  controller: _year,
                                  enabled: !_saving,
                                  keyboardType: TextInputType.number,
                                  decoration: InputDecoration(labelText: 'Año', errorText: _serverErrors['year']),
                                  validator: (value) {
                                    final year = int.tryParse(value?.trim() ?? '');
                                    if (year == null || year < 1950 || year > maxYear) {
                                      return 'Ingresa un año entre 1950 y $maxYear.';
                                    }
                                    return null;
                                  },
                                ),
                              ),
                              const SizedBox(width: AppSpacing.lg),
                              Expanded(
                                child: TextFormField(
                                  controller: _plate,
                                  enabled: !_saving,
                                  textCapitalization: TextCapitalization.characters,
                                  decoration: InputDecoration(
                                    labelText: 'Placa',
                                    errorText: _serverErrors['licensePlate'],
                                  ),
                                  validator: (value) {
                                    final text = (value ?? '').toUpperCase().replaceAll(RegExp(r'[\s-]'), '');
                                    if (text.isEmpty) {
                                      return 'La placa es obligatoria.';
                                    }
                                    return RegExp(r'^[A-Z0-9]{3,15}$').hasMatch(text)
                                        ? null
                                        : 'La placa debe tener entre 3 y 15 letras o números.';
                                  },
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.lg),
                          TextFormField(
                            controller: _vin,
                            enabled: !_saving,
                            textCapitalization: TextCapitalization.characters,
                            decoration: InputDecoration(
                              labelText: 'VIN (opcional)',
                              errorText: _serverErrors['vin'],
                            ),
                            validator: (value) {
                              final text = (value ?? '').trim().toUpperCase();
                              if (text.isEmpty) {
                                return null;
                              }
                              return RegExp(r'^[A-HJ-NPR-Z0-9]{17}$').hasMatch(text)
                                  ? null
                                  : 'El VIN debe tener 17 caracteres alfanuméricos (sin I, O ni Q).';
                            },
                          ),
                          const SizedBox(height: AppSpacing.lg),
                          TextFormField(
                            controller: _mileage,
                            enabled: !_saving,
                            keyboardType: TextInputType.number,
                            decoration: InputDecoration(
                              labelText: 'Kilometraje actual (opcional)',
                              errorText: _serverErrors['currentMileage'],
                            ),
                            validator: (value) {
                              final text = value?.trim() ?? '';
                              if (text.isEmpty) {
                                return null;
                              }
                              final km = int.tryParse(text);
                              return km == null || km < 0 ? 'Ingresa un número entero mayor o igual a 0.' : null;
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
                                child: Text(_saving ? 'Guardando…' : 'Guardar vehículo'),
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
