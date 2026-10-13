import 'package:flutter/material.dart';

import '../models/part.dart';
import '../utils/app_tokens.dart';
import '../utils/formatters.dart';
import 'confirm_dialog.dart';

const int _maxQuantity = 99999;
const int _maxStock = 99999999;

/// Resultado de una entrada de inventario.
typedef EntryInput = ({int quantity, String reason});

/// Resultado de un ajuste por conteo físico.
typedef AdjustmentInput = ({int countedStock, String reason});

/// Reabastecimiento: pide la cantidad a sumar y el motivo. Devuelve `null` si se cancela.
Future<EntryInput?> showEntryDialog(BuildContext context, {required Part part}) {
  return showDialog<EntryInput>(
    context: context,
    builder: (_) => _MovementDialog(part: part, adjustment: false),
  );
}

/// Ajuste por conteo físico: pide el stock contado y el motivo, muestra la diferencia y confirma antes de guardar.
Future<AdjustmentInput?> showAdjustmentDialog(BuildContext context, {required Part part}) {
  return showDialog<AdjustmentInput>(
    context: context,
    builder: (_) => _MovementDialog(part: part, adjustment: true),
  );
}

class _MovementDialog extends StatefulWidget {
  const _MovementDialog({required this.part, required this.adjustment});

  final Part part;
  final bool adjustment;

  @override
  State<_MovementDialog> createState() => _MovementDialogState();
}

class _MovementDialogState extends State<_MovementDialog> {
  final _formKey = GlobalKey<FormState>();
  final _amount = TextEditingController();
  final _reason = TextEditingController();

  @override
  void dispose() {
    _amount.dispose();
    _reason.dispose();
    super.dispose();
  }

  int? get _typed => int.tryParse(_amount.text.trim());

  /// Diferencia entre el stock contado y el registrado (solo en el ajuste).
  int? get _difference {
    final counted = _typed;
    return counted == null ? null : counted - widget.part.stock;
  }

  String? _validateAmount(String? value) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) {
      return widget.adjustment ? 'Indica el stock contado.' : 'Indica la cantidad.';
    }
    final number = int.tryParse(text);
    if (number == null) {
      return 'Escribe un número entero.';
    }
    if (widget.adjustment) {
      if (number < 0 || number > _maxStock) {
        return 'El stock contado debe estar entre 0 y $_maxStock.';
      }
      if (number == widget.part.stock) {
        return 'El conteo coincide con el stock registrado: no hay nada que ajustar.';
      }
    } else if (number < 1 || number > _maxQuantity) {
      return 'La cantidad debe estar entre 1 y $_maxQuantity.';
    }
    return null;
  }

  Future<void> _confirm() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    final amount = int.parse(_amount.text.trim());
    final reason = _reason.text.trim();
    if (widget.adjustment) {
      final difference = _difference!;
      final confirmed = await showConfirmDialog(
        context,
        title: 'Confirmar ajuste',
        message: 'El stock de ${widget.part.code} cambiará de ${formatQuantity(widget.part.stock)} a '
            '${formatQuantity(amount)} (${difference > 0 ? '+' : ''}${formatQuantity(difference)}). ¿Continuar?',
      );
      if (!confirmed || !mounted) {
        return;
      }
      Navigator.of(context).pop<AdjustmentInput>((countedStock: amount, reason: reason));
    } else {
      Navigator.of(context).pop<EntryInput>((quantity: amount, reason: reason));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final difference = widget.adjustment ? _difference : null;
    return AlertDialog(
      title: Text(widget.adjustment ? 'Ajustar inventario' : 'Registrar entrada'),
      content: SizedBox(
        width: AppSizes.dialogWidth,
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${widget.part.code} · ${widget.part.name}', style: theme.textTheme.bodyLarge),
              const SizedBox(height: AppSpacing.xs),
              Text('Stock actual: ${formatQuantity(widget.part.stock)}', style: theme.textTheme.bodySmall),
              const SizedBox(height: AppSpacing.lg),
              TextFormField(
                controller: _amount,
                autofocus: true,
                keyboardType: TextInputType.number,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  labelText: widget.adjustment ? 'Stock contado' : 'Cantidad que entra',
                ),
                validator: _validateAmount,
              ),
              if (difference != null && difference != 0) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  'Diferencia: ${difference > 0 ? '+' : ''}${formatQuantity(difference)}',
                  style: theme.textTheme.bodyMedium?.copyWith(color: difference > 0 ? AppColors.success : AppColors.danger),
                ),
              ],
              const SizedBox(height: AppSpacing.lg),
              TextFormField(
                controller: _reason,
                minLines: 2,
                maxLines: 4,
                decoration: InputDecoration(
                  labelText: widget.adjustment ? 'Motivo del ajuste' : 'Motivo de la entrada',
                  alignLabelWithHint: true,
                ),
                validator: (value) {
                  final text = value?.trim() ?? '';
                  if (text.isEmpty) {
                    return 'Indica el motivo.';
                  }
                  return text.length > 255 ? 'El motivo no puede tener más de 255 caracteres.' : null;
                },
              ),
            ],
          ),
        ),
      ),
      actions: [
        OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
        FilledButton(onPressed: _confirm, child: Text(widget.adjustment ? 'Ajustar' : 'Registrar entrada')),
      ],
    );
  }
}
