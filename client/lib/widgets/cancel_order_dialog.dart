import 'package:flutter/material.dart';

import '../utils/app_tokens.dart';

/// Diálogo para cancelar una orden: pide el motivo (obligatorio) y la confirmación.
/// Devuelve el motivo escrito si se confirma o `null` si se cancela el diálogo.
Future<String?> showCancelOrderDialog(BuildContext context, {required String folio}) {
  return showDialog<String>(
    context: context,
    builder: (_) => _CancelOrderDialog(folio: folio),
  );
}

class _CancelOrderDialog extends StatefulWidget {
  const _CancelOrderDialog({required this.folio});

  final String folio;

  @override
  State<_CancelOrderDialog> createState() => _CancelOrderDialogState();
}

class _CancelOrderDialogState extends State<_CancelOrderDialog> {
  final _formKey = GlobalKey<FormState>();
  final _reason = TextEditingController();

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  void _confirm() {
    if (_formKey.currentState!.validate()) {
      Navigator.of(context).pop(_reason.text.trim());
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Cancelar orden'),
      content: SizedBox(
        width: AppSizes.dialogWidth,
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('¿Seguro que quieres cancelar la orden ${widget.folio}? Esta acción no se puede deshacer.'),
              const SizedBox(height: AppSpacing.lg),
              TextFormField(
                controller: _reason,
                autofocus: true,
                minLines: 2,
                maxLines: 4,
                decoration: const InputDecoration(labelText: 'Motivo de la cancelación', alignLabelWithHint: true),
                validator: (value) {
                  final text = value?.trim() ?? '';
                  if (text.isEmpty) {
                    return 'Indica el motivo de la cancelación.';
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
        FilledButton(onPressed: _confirm, child: const Text('Confirmar')),
      ],
    );
  }
}
