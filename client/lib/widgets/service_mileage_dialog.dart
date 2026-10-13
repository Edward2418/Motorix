import 'package:flutter/material.dart';

import '../utils/app_tokens.dart';
import '../utils/formatters.dart';

const int _maxMileage = 4294967295;

/// Valida un kilometraje del servicio: entero, dentro de rango y no menor al de entrada.
String? _validateMileage(String? value, int entryMileage) {
  final text = value?.trim() ?? '';
  if (text.isEmpty) {
    return 'Indica el kilometraje del servicio.';
  }
  final mileage = int.tryParse(text);
  if (mileage == null || mileage < 0 || mileage > _maxMileage) {
    return 'Escribe un número entero válido.';
  }
  if (mileage < entryMileage) {
    return 'No puede ser menor al kilometraje de entrada (${formatMileage(entryMileage)}).';
  }
  return null;
}

/// Pide el kilometraje con el que se termina el servicio, con el de entrada como valor inicial.
/// Devuelve el valor confirmado o `null` si se cancela.
Future<int?> showServiceMileageDialog(BuildContext context, {required int entryMileage}) {
  return showDialog<int>(
    context: context,
    builder: (_) => _ServiceMileageDialog(entryMileage: entryMileage, initial: entryMileage),
  );
}

/// Resultado de la corrección del kilometraje del servicio (solo administración).
typedef MileageCorrection = ({int mileage, String reason});

/// Corrige el kilometraje del servicio de una orden finalizada: exige el motivo.
Future<MileageCorrection?> showServiceMileageCorrectionDialog(
  BuildContext context, {
  required int entryMileage,
  required int? current,
}) {
  return showDialog<MileageCorrection>(
    context: context,
    builder: (_) => _ServiceMileageDialog(entryMileage: entryMileage, initial: current ?? entryMileage, askReason: true),
  );
}

class _ServiceMileageDialog extends StatefulWidget {
  const _ServiceMileageDialog({required this.entryMileage, required this.initial, this.askReason = false});

  final int entryMileage;
  final int initial;
  final bool askReason;

  @override
  State<_ServiceMileageDialog> createState() => _ServiceMileageDialogState();
}

class _ServiceMileageDialogState extends State<_ServiceMileageDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _mileage = TextEditingController(text: '${widget.initial}');
  final _reason = TextEditingController();

  @override
  void dispose() {
    _mileage.dispose();
    _reason.dispose();
    super.dispose();
  }

  void _confirm() {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    final mileage = int.parse(_mileage.text.trim());
    if (widget.askReason) {
      Navigator.of(context).pop<MileageCorrection>((mileage: mileage, reason: _reason.text.trim()));
    } else {
      Navigator.of(context).pop<int>(mileage);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.askReason ? 'Corregir kilometraje del servicio' : 'Kilometraje del servicio'),
      content: SizedBox(
        width: AppSizes.dialogWidth,
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.askReason
                    ? 'La corrección queda registrada con tu usuario y el motivo.'
                    : 'Indica el kilometraje del vehículo al terminar el servicio. Se actualizará su kilometraje actual si es mayor.',
              ),
              const SizedBox(height: AppSpacing.lg),
              TextFormField(
                controller: _mileage,
                autofocus: true,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'Kilometraje del servicio',
                  helperText: 'Kilometraje de entrada: ${formatMileage(widget.entryMileage)}',
                ),
                validator: (value) => _validateMileage(value, widget.entryMileage),
              ),
              if (widget.askReason) ...[
                const SizedBox(height: AppSpacing.lg),
                TextFormField(
                  controller: _reason,
                  minLines: 2,
                  maxLines: 4,
                  decoration: const InputDecoration(labelText: 'Motivo de la corrección', alignLabelWithHint: true),
                  validator: (value) {
                    final text = value?.trim() ?? '';
                    if (text.isEmpty) {
                      return 'Indica el motivo de la corrección.';
                    }
                    return text.length > 255 ? 'El motivo no puede tener más de 255 caracteres.' : null;
                  },
                ),
              ],
            ],
          ),
        ),
      ),
      actions: [
        OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
        FilledButton(onPressed: _confirm, child: const Text('Confirmar')),
      ],
    );
  }
}
