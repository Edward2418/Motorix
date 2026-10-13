import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../providers/maintenance_provider.dart';
import '../services/api_client.dart';
import '../utils/app_tokens.dart';
import '../utils/formatters.dart';

const int _maxMileage = 4294967295;

/// Programa el próximo mantenimiento. [onSubmit] llama a la API; si el servidor rechaza los datos, los errores
/// se muestran en los campos sin cerrar el diálogo. Devuelve `true` si se guardó.
/// [referenceMileage] es solo una referencia visible (el kilometraje conocido del vehículo en la orden).
Future<bool> showMaintenanceDialog(
  BuildContext context, {
  required Future<void> Function(MaintenanceInput input) onSubmit,
  int? referenceMileage,
}) async {
  final saved = await showDialog<bool>(
    context: context,
    builder: (_) => _MaintenanceDialog(onSubmit: onSubmit, referenceMileage: referenceMileage),
  );
  return saved ?? false;
}

class _MaintenanceDialog extends StatefulWidget {
  const _MaintenanceDialog({required this.onSubmit, this.referenceMileage});

  final Future<void> Function(MaintenanceInput input) onSubmit;
  final int? referenceMileage;

  @override
  State<_MaintenanceDialog> createState() => _MaintenanceDialogState();
}

class _MaintenanceDialogState extends State<_MaintenanceDialog> {
  final _formKey = GlobalKey<FormState>();
  final _description = TextEditingController();
  final _mileage = TextEditingController();
  final _notes = TextEditingController();

  DateTime? _dueDate;
  bool _saving = false;
  String? _targetError;
  String? _generalError;
  Map<String, String> _serverErrors = const {};

  @override
  void dispose() {
    _description.dispose();
    _mileage.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final today = DateUtils.dateOnly(DateTime.now());
    final picked = await showDatePicker(
      context: context,
      initialDate: _dueDate ?? today.add(const Duration(days: 90)),
      firstDate: today,
      lastDate: DateTime(today.year + 10),
    );
    if (picked != null) {
      setState(() {
        _dueDate = picked;
        _targetError = null;
      });
    }
  }

  String? _validateMileage(String? value) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) {
      return null;
    }
    final km = int.tryParse(text);
    if (km == null || km < 1 || km > _maxMileage) {
      return 'Escribe un número entero mayor que cero.';
    }
    return null;
  }

  Future<void> _submit() async {
    setState(() {
      _generalError = null;
      _serverErrors = const {};
    });
    final valid = _formKey.currentState!.validate();
    final hasTarget = _dueDate != null || _mileage.text.trim().isNotEmpty;
    setState(() => _targetError = hasTarget ? null : 'Indica una fecha, un kilometraje o ambos.');
    if (!valid || !hasTarget) {
      return;
    }
    setState(() => _saving = true);
    try {
      await widget.onSubmit(MaintenanceInput(
        description: _description.text.trim(),
        dueDate: _dueDate,
        dueMileage: _mileage.text.trim().isEmpty ? null : int.parse(_mileage.text.trim()),
        notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
      ));
      if (mounted) {
        Navigator.of(context).pop(true);
      }
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
    final theme = Theme.of(context);
    return AlertDialog(
      title: const Text('Programar próximo mantenimiento'),
      content: SizedBox(
        width: AppSizes.dialogWidth,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextFormField(
                  controller: _description,
                  autofocus: true,
                  enabled: !_saving,
                  decoration: InputDecoration(labelText: 'Descripción', errorText: _serverErrors['description']),
                  validator: (value) {
                    final text = value?.trim() ?? '';
                    if (text.isEmpty) {
                      return 'La descripción es obligatoria.';
                    }
                    return text.length > 255 ? 'La descripción no puede tener más de 255 caracteres.' : null;
                  },
                ),
                const SizedBox(height: AppSpacing.lg),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _saving ? null : _pickDate,
                        icon: const Icon(LucideIcons.calendarDays, size: AppSizes.icon),
                        label: Text(_dueDate == null ? 'Elegir fecha' : formatDate(_dueDate!)),
                      ),
                    ),
                    if (_dueDate != null)
                      IconButton(
                        tooltip: 'Quitar fecha',
                        onPressed: _saving ? null : () => setState(() => _dueDate = null),
                        icon: const Icon(LucideIcons.x, size: AppSizes.icon),
                      ),
                  ],
                ),
                if (_serverErrors['dueDate'] != null)
                  Padding(
                    padding: const EdgeInsets.only(top: AppSpacing.xs),
                    child: Text(_serverErrors['dueDate']!, style: theme.textTheme.bodySmall?.copyWith(color: AppColors.danger)),
                  ),
                const SizedBox(height: AppSpacing.lg),
                TextFormField(
                  controller: _mileage,
                  enabled: !_saving,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: 'Kilometraje objetivo (opcional)',
                    helperText: widget.referenceMileage == null
                        ? 'Debe ser mayor al kilometraje actual del vehículo.'
                        : 'Debe ser mayor al actual del vehículo (referencia: ${formatMileage(widget.referenceMileage!)}).',
                    errorText: _serverErrors['dueMileage'],
                  ),
                  validator: _validateMileage,
                ),
                if (_targetError != null)
                  Padding(
                    padding: const EdgeInsets.only(top: AppSpacing.sm),
                    child: Text(_targetError!, style: theme.textTheme.bodySmall?.copyWith(color: AppColors.danger)),
                  ),
                const SizedBox(height: AppSpacing.lg),
                TextFormField(
                  controller: _notes,
                  enabled: !_saving,
                  minLines: 2,
                  maxLines: 4,
                  decoration: InputDecoration(
                    labelText: 'Notas (opcional)',
                    alignLabelWithHint: true,
                    errorText: _serverErrors['notes'],
                  ),
                  validator: (value) => (value?.trim().length ?? 0) > 1000 ? 'Las notas no pueden tener más de 1000 caracteres.' : null,
                ),
                if (_generalError != null) ...[
                  const SizedBox(height: AppSpacing.lg),
                  Text(_generalError!, style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.danger)),
                ],
              ],
            ),
          ),
        ),
      ),
      actions: [
        OutlinedButton(onPressed: _saving ? null : () => Navigator.of(context).pop(false), child: const Text('Cancelar')),
        FilledButton(onPressed: _saving ? null : _submit, child: Text(_saving ? 'Guardando…' : 'Programar')),
      ],
    );
  }
}
