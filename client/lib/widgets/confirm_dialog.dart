import 'package:flutter/material.dart';

/// Diálogo de confirmación obligatorio para acciones destructivas o de salida
/// (docs/design-system.md §8.5). Devuelve `true` solo si el usuario pulsa «Confirmar».
Future<bool> showConfirmDialog(
  BuildContext context, {
  required String message,
  String title = 'Confirmar acción',
  bool irreversible = false,
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(title),
      content: Text(irreversible ? '$message Esta acción no se puede deshacer.' : message),
      actions: [
        OutlinedButton(
          onPressed: () => Navigator.of(dialogContext).pop(false),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(dialogContext).pop(true),
          child: const Text('Confirmar'),
        ),
      ],
    ),
  );
  return result ?? false;
}
