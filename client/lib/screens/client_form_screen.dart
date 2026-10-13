import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/client.dart';
import '../providers/clients_provider.dart';
import '../services/api_client.dart';
import '../utils/app_tokens.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/section_navigator.dart';

/// Formulario de alta y edición de cliente. Al guardar cierra devolviendo `true`.
class ClientFormScreen extends StatefulWidget {
  const ClientFormScreen({super.key, this.client});

  /// Cliente a editar; si es nulo, el formulario registra uno nuevo.
  final Client? client;

  @override
  State<ClientFormScreen> createState() => _ClientFormScreenState();
}

class _ClientFormScreenState extends State<ClientFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name = TextEditingController(text: widget.client?.name ?? '');
  late final TextEditingController _phone = TextEditingController(text: widget.client?.phone ?? '');
  late final TextEditingController _email = TextEditingController(text: widget.client?.email ?? '');

  bool _saving = false;
  bool _saved = false;
  String? _generalError;
  Map<String, String> _serverErrors = const {};

  bool get _editing => widget.client != null;

  bool get _dirty {
    if (_saved) {
      return false;
    }
    final client = widget.client;
    if (client != null) {
      return _name.text != client.name || _phone.text != client.phone || _email.text != (client.email ?? '');
    }
    return _name.text.isNotEmpty || _phone.text.isNotEmpty || _email.text.isNotEmpty;
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _email.dispose();
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
      final clients = context.read<ClientsProvider>();
      if (_editing) {
        await clients.update(
          widget.client!.id,
          name: _name.text.trim(),
          phone: _phone.text.trim(),
          email: _email.text.trim(),
        );
      } else {
        await clients.create(
          name: _name.text.trim(),
          phone: _phone.text.trim(),
          email: _email.text.trim(),
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
          title: Text(_editing ? 'Editar cliente' : 'Registrar cliente'),
          backgroundColor: AppColors.surface,
          scrolledUnderElevation: 0,
        ),
        body: PagePadding(
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
                          controller: _name,
                          enabled: !_saving,
                          autofocus: true,
                          decoration: InputDecoration(labelText: 'Nombre', errorText: _serverErrors['name']),
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
                          controller: _phone,
                          enabled: !_saving,
                          keyboardType: TextInputType.phone,
                          decoration: InputDecoration(labelText: 'Teléfono', errorText: _serverErrors['phone']),
                          validator: (value) {
                            final text = value?.trim() ?? '';
                            if (text.isEmpty) {
                              return 'El teléfono es obligatorio.';
                            }
                            final digits = text.replaceAll(RegExp(r'\D'), '').length;
                            return digits < 7 || digits > 15 ? 'El teléfono debe tener entre 7 y 15 dígitos.' : null;
                          },
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        TextFormField(
                          controller: _email,
                          enabled: !_saving,
                          keyboardType: TextInputType.emailAddress,
                          decoration: InputDecoration(
                            labelText: 'Correo electrónico (opcional)',
                            errorText: _serverErrors['email'],
                          ),
                          validator: (value) {
                            final text = value?.trim() ?? '';
                            if (text.isEmpty) {
                              return null;
                            }
                            return RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(text)
                                ? null
                                : 'El correo electrónico no tiene un formato válido.';
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
                              child: Text(_saving ? 'Guardando…' : (_editing ? 'Guardar cambios' : 'Guardar cliente')),
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
    );
  }
}
