import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/user.dart';
import '../providers/users_provider.dart';
import '../services/api_client.dart';
import '../utils/app_tokens.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/section_navigator.dart';
import 'change_password_dialog.dart' show passwordPolicyMessage;

/// Formulario de alta y edición de usuarios (solo ADMIN). En edición no se cambia el usuario ni la contraseña.
class UserFormScreen extends StatefulWidget {
  const UserFormScreen({super.key, this.user});

  final User? user;

  @override
  State<UserFormScreen> createState() => _UserFormScreenState();
}

class _UserFormScreenState extends State<UserFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _username = TextEditingController(text: widget.user?.username ?? '');
  late final TextEditingController _name = TextEditingController(text: widget.user?.name ?? '');
  late final TextEditingController _email = TextEditingController(text: widget.user?.email ?? '');
  final _password = TextEditingController();
  late UserRole _role = widget.user?.role ?? UserRole.receptionist;

  bool _saving = false;
  bool _saved = false;
  String? _generalError;
  Map<String, String> _serverErrors = const {};

  bool get _editing => widget.user != null;

  bool get _dirty {
    if (_saved) {
      return false;
    }
    if (_editing) {
      final user = widget.user!;
      return _name.text != user.name || _email.text != user.email || _role != user.role;
    }
    return [_username, _name, _email, _password].any((controller) => controller.text.isNotEmpty);
  }

  @override
  void dispose() {
    for (final controller in [_username, _name, _email, _password]) {
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
    final users = context.read<UsersProvider>();
    try {
      if (_editing) {
        await users.update(widget.user!.id, name: _name.text.trim(), email: _email.text.trim(), role: _role);
      } else {
        await users.create(
          username: _username.text.trim(),
          name: _name.text.trim(),
          email: _email.text.trim(),
          password: _password.text,
          role: _role,
        );
      }
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

  @override
  Widget build(BuildContext context) {
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
          title: Text(_editing ? 'Editar usuario' : 'Registrar usuario'),
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
                          TextFormField(
                            controller: _username,
                            enabled: !_saving && !_editing,
                            decoration: InputDecoration(
                              labelText: 'Nombre de usuario',
                              helperText: _editing ? 'El nombre de usuario no se puede cambiar.' : null,
                              errorText: _serverErrors['username'],
                            ),
                            validator: (value) {
                              if (_editing) {
                                return null;
                              }
                              final text = value?.trim() ?? '';
                              if (text.isEmpty) {
                                return 'El nombre de usuario es obligatorio.';
                              }
                              return RegExp(r'^[A-Za-z0-9._-]{3,50}$').hasMatch(text)
                                  ? null
                                  : 'Usa de 3 a 50 caracteres: letras, números, punto, guion y guion bajo.';
                            },
                          ),
                          const SizedBox(height: AppSpacing.lg),
                          TextFormField(
                            controller: _name,
                            enabled: !_saving,
                            decoration: InputDecoration(labelText: 'Nombre completo', errorText: _serverErrors['name']),
                            validator: (value) {
                              final text = value?.trim() ?? '';
                              if (text.isEmpty) {
                                return 'El nombre es obligatorio.';
                              }
                              return text.length > 100 ? 'El nombre no puede tener más de 100 caracteres.' : null;
                            },
                          ),
                          const SizedBox(height: AppSpacing.lg),
                          TextFormField(
                            controller: _email,
                            enabled: !_saving,
                            keyboardType: TextInputType.emailAddress,
                            decoration: InputDecoration(
                              labelText: 'Correo electrónico',
                              errorText: _serverErrors['email'],
                            ),
                            validator: (value) {
                              final text = value?.trim() ?? '';
                              if (text.isEmpty) {
                                return 'El correo electrónico es obligatorio.';
                              }
                              return RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(text)
                                  ? null
                                  : 'El correo electrónico no tiene un formato válido.';
                            },
                          ),
                          if (!_editing) ...[
                            const SizedBox(height: AppSpacing.lg),
                            TextFormField(
                              controller: _password,
                              enabled: !_saving,
                              obscureText: true,
                              decoration: InputDecoration(
                                labelText: 'Contraseña inicial',
                                helperText: 'Mínimo 8 caracteres, con mayúscula, minúscula y número.',
                                errorText: _serverErrors['password'],
                                errorMaxLines: 3,
                              ),
                              validator: (value) {
                                if (value == null || value.isEmpty) {
                                  return 'La contraseña es obligatoria.';
                                }
                                return passwordPolicyMessage(value);
                              },
                            ),
                          ],
                          const SizedBox(height: AppSpacing.lg),
                          DropdownButtonFormField<UserRole>(
                            initialValue: _role,
                            decoration: InputDecoration(labelText: 'Rol', errorText: _serverErrors['role']),
                            items: [
                              for (final role in UserRole.values) DropdownMenuItem(value: role, child: Text(role.label)),
                            ],
                            onChanged: _saving ? null : (value) => setState(() => _role = value ?? _role),
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
                                child: Text(_saving ? 'Guardando…' : 'Guardar usuario'),
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
