import 'package:flutter/material.dart';

import '../models/service_order.dart';
import '../models/service_type.dart';
import '../utils/app_tokens.dart';

/// Datos capturados en el diálogo de una línea (servicio o mano de obra).
typedef LineInput = ({String description, double amount, int? serviceTypeId});

const double _maxAmount = 99999999.99;

/// Valida el importe escrito: número ≥ 0 y ≤ 99,999,999.99 con máximo dos decimales.
/// Devuelve el mensaje de error o `null` si es válido.
String? validateAmountText(String? value) {
  final text = (value ?? '').trim().replaceAll(',', '.');
  if (text.isEmpty) {
    return 'El importe es obligatorio.';
  }
  final amount = double.tryParse(text);
  if (amount == null) {
    return 'Ingresa un importe numérico.';
  }
  if (amount < 0) {
    return 'El importe no puede ser negativo.';
  }
  if (amount > _maxAmount) {
    return 'El importe no puede superar 99,999,999.99.';
  }
  if (RegExp(r'\.\d{3,}$').hasMatch(text)) {
    return 'El importe admite como máximo dos decimales.';
  }
  return null;
}

/// Diálogo de alta o edición de una línea. Devuelve los datos si se guardan o `null` si se cancela. Con [serviceTypes]
/// (solo servicios: los tipos activos del catálogo) ofrece elegir el tipo, o dejarlo sin tipo; sin lista, o con la lista
/// vacía y sin tipo actual, no muestra el selector.
Future<LineInput?> showOrderLineDialog(
  BuildContext context, {
  required String title,
  OrderLine? initial,
  List<ServiceType>? serviceTypes,
}) {
  return showDialog<LineInput>(
    context: context,
    builder: (_) => _OrderLineDialog(title: title, initial: initial, serviceTypes: serviceTypes),
  );
}

class _OrderLineDialog extends StatefulWidget {
  const _OrderLineDialog({required this.title, this.initial, this.serviceTypes});

  final String title;
  final OrderLine? initial;
  final List<ServiceType>? serviceTypes;

  @override
  State<_OrderLineDialog> createState() => _OrderLineDialogState();
}

class _OrderLineDialogState extends State<_OrderLineDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _description = TextEditingController(text: widget.initial?.description ?? '');
  late final TextEditingController _amount = TextEditingController(
    text: widget.initial == null ? '' : widget.initial!.amount.toStringAsFixed(2),
  );
  late int? _serviceTypeId = widget.initial?.serviceTypeId;

  // Se muestra el selector si hay tipos activos o si la línea ya tiene uno (aunque se haya desactivado después).
  bool get _showTypes => widget.serviceTypes != null && (widget.serviceTypes!.isNotEmpty || _serviceTypeId != null);

  // Opciones: los tipos activos y, si la línea ya usa uno que dejó de estar activo, ese también, marcado.
  List<DropdownMenuItem<int?>> get _typeItems {
    final active = widget.serviceTypes ?? const <ServiceType>[];
    final current = widget.initial;
    return [
      const DropdownMenuItem<int?>(value: null, child: Text('Sin tipo')),
      for (final type in active) DropdownMenuItem<int?>(value: type.id, child: Text(type.name)),
      if (current?.serviceTypeId != null && !active.any((type) => type.id == current!.serviceTypeId))
        DropdownMenuItem<int?>(
          value: current!.serviceTypeId,
          child: Text('${current.serviceTypeName ?? 'Tipo ${current.serviceTypeId}'} (desactivado)'),
        ),
    ];
  }

  @override
  void dispose() {
    _description.dispose();
    _amount.dispose();
    super.dispose();
  }

  void _save() {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    Navigator.of(context).pop((
      description: _description.text.trim(),
      amount: double.parse(_amount.text.trim().replaceAll(',', '.')),
      serviceTypeId: _serviceTypeId,
    ));
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: SizedBox(
        width: AppSizes.dialogWidth,
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: _description,
                autofocus: true,
                decoration: const InputDecoration(labelText: 'Descripción'),
                validator: (value) {
                  final text = value?.trim() ?? '';
                  if (text.isEmpty) {
                    return 'La descripción es obligatoria.';
                  }
                  return text.length > 255 ? 'La descripción no puede tener más de 255 caracteres.' : null;
                },
              ),
              const SizedBox(height: AppSpacing.lg),
              TextFormField(
                controller: _amount,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Importe', prefixText: r'$ '),
                validator: validateAmountText,
                onFieldSubmitted: (_) => _save(),
              ),
              if (_showTypes) ...[
                const SizedBox(height: AppSpacing.lg),
                DropdownButtonFormField<int?>(
                  isExpanded: true,
                  initialValue: _serviceTypeId,
                  decoration: const InputDecoration(labelText: 'Tipo de servicio (opcional)'),
                  items: _typeItems,
                  onChanged: (value) => setState(() => _serviceTypeId = value),
                ),
              ],
            ],
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
