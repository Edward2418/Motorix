import 'package:flutter/material.dart';

import '../utils/app_tokens.dart';

/// Diálogo de confirmación que exige un motivo. Devuelve el motivo escrito o `null` si se cancela.
Future<String?> showReasonDialog(
  BuildContext context, {
  required String title,
  required String message,
  String label = 'Motivo',
  String confirmLabel = 'Confirmar',
}) {
  return showDialog<String>(
    context: context,
    builder: (_) => _ReasonDialog(title: title, message: message, label: label, confirmLabel: confirmLabel),
  );
}

class _ReasonDialog extends StatefulWidget {
  const _ReasonDialog({required this.title, required this.message, required this.label, required this.confirmLabel});

  final String title;
  final String message;
  final String label;
  final String confirmLabel;

  @override
  State<_ReasonDialog> createState() => _ReasonDialogState();
}

class _ReasonDialogState extends State<_ReasonDialog> {
  final _formKey = GlobalKey<FormState>();
  final _reason = TextEditingController();

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
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
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(widget.message),
              const SizedBox(height: AppSpacing.lg),
              TextFormField(
                controller: _reason,
                autofocus: true,
                minLines: 2,
                maxLines: 4,
                decoration: InputDecoration(labelText: widget.label, alignLabelWithHint: true),
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
        FilledButton(
          onPressed: () {
            if (_formKey.currentState!.validate()) {
              Navigator.of(context).pop(_reason.text.trim());
            }
          },
          child: Text(widget.confirmLabel),
        ),
      ],
    );
  }
}
