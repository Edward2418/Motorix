import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../services/api_client.dart';
import '../utils/app_tokens.dart';
import '../widgets/view_states.dart';

/// Diálogo para cambiar la contraseña del usuario actual. Muestra qué requisito de la política falta.
Future<void> showChangePasswordDialog(BuildContext context) {
  return showDialog<void>(context: context, builder: (_) => const ChangePasswordDialog());
}

class ChangePasswordDialog extends StatefulWidget {
  const ChangePasswordDialog({super.key});

  @override
  State<ChangePasswordDialog> createState() => _ChangePasswordDialogState();
}

class _ChangePasswordDialogState extends State<ChangePasswordDialog> {
  final _formKey = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _new = TextEditingController();
  final _confirm = TextEditingController();

  bool _saving = false;
  String? _currentError;
  List<String> _newErrors = const [];
  String? _generalError;

  @override
  void dispose() {
    _current.dispose();
    _new.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _currentError = null;
      _newErrors = const [];
      _generalError = null;
    });
    if (!_formKey.currentState!.validate()) {
      return;
    }
    setState(() => _saving = true);
    final auth = context.read<AuthProvider>();
    try {
      await auth.changePassword(_current.text, _new.text);
      if (!mounted) {
        return;
      }
      Navigator.of(context).pop();
      showFeedback(context, 'Tu contraseña se actualizó correctamente.');
    } on ApiException catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _saving = false;
        _currentError = e.fieldErrors['currentPassword'];
        _newErrors = e.fieldErrors['newPassword'] == null ? const [] : [e.fieldErrors['newPassword']!];
        _generalError = e.fieldErrors.isEmpty ? e.message : null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Cambiar contraseña'),
      content: SizedBox(
        width: AppSizes.dialogWidth,
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextFormField(
                controller: _current,
                obscureText: true,
                decoration: InputDecoration(labelText: 'Contraseña actual', errorText: _currentError),
                validator: (value) => (value == null || value.isEmpty) ? 'Ingresa tu contraseña actual.' : null,
              ),
              const SizedBox(height: AppSpacing.lg),
              TextFormField(
                controller: _new,
                obscureText: true,
                decoration: InputDecoration(
                  labelText: 'Contraseña nueva',
                  helperText: 'Mínimo 8 caracteres, con mayúscula, minúscula y número.',
                  helperMaxLines: 2,
                  errorText: _newErrors.isEmpty ? null : _newErrors.join(' '),
                  errorMaxLines: 4,
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Ingresa la contraseña nueva.';
                  }
                  return passwordPolicyMessage(value);
                },
              ),
              const SizedBox(height: AppSpacing.lg),
              TextFormField(
                controller: _confirm,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Confirmar contraseña nueva'),
                validator: (value) => value != _new.text ? 'Las contraseñas no coinciden.' : null,
              ),
              if (_generalError != null) ...[
                const SizedBox(height: AppSpacing.lg),
                Text(_generalError!, style: const TextStyle(color: AppColors.danger)),
              ],
            ],
          ),
        ),
      ),
      actions: [
        OutlinedButton(
          onPressed: _saving ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: _saving ? null : _submit,
          child: Text(_saving ? 'Guardando…' : 'Guardar'),
        ),
      ],
    );
  }
}

/// Valida la política mínima en el cliente (el backend la vuelve a validar) y devuelve qué falta.
String? passwordPolicyMessage(String value) {
  final missing = <String>[];
  if (value.length < 8) {
    missing.add('al menos 8 caracteres');
  }
  if (!RegExp(r'[A-ZÁÉÍÓÚÑÜ]').hasMatch(value)) {
    missing.add('una mayúscula');
  }
  if (!RegExp(r'[a-záéíóúñü]').hasMatch(value)) {
    missing.add('una minúscula');
  }
  if (!RegExp(r'\d').hasMatch(value)) {
    missing.add('un número');
  }
  return missing.isEmpty ? null : 'Falta incluir: ${missing.join(', ')}.';
}
