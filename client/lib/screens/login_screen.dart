import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../utils/app_tokens.dart';

/// Pantalla de inicio de sesión: un solo campo para usuario o correo electrónico.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifier = TextEditingController();
  final _password = TextEditingController();

  @override
  void dispose() {
    _identifier.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    await context.read<AuthProvider>().login(_identifier.text, _password.text);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final theme = Theme.of(context);
    final message = auth.error ?? (auth.sessionExpired ? 'Tu sesión terminó. Inicia sesión de nuevo.' : null);

    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: AppSizes.authCardWidth),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.xl),
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text('Motorix', style: theme.textTheme.headlineMedium?.copyWith(color: AppColors.primary)),
                      const SizedBox(height: AppSpacing.xs),
                      Text('Inicia sesión para continuar', style: theme.textTheme.bodySmall),
                      const SizedBox(height: AppSpacing.xl),
                      TextFormField(
                        controller: _identifier,
                        enabled: !auth.loading,
                        autofocus: true,
                        textInputAction: TextInputAction.next,
                        decoration: InputDecoration(
                          labelText: 'Usuario o correo electrónico',
                          errorText: auth.fieldErrors['identifier'],
                        ),
                        validator: (value) =>
                            (value == null || value.trim().isEmpty) ? 'Ingresa tu usuario o correo electrónico.' : null,
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      TextFormField(
                        controller: _password,
                        enabled: !auth.loading,
                        obscureText: true,
                        onFieldSubmitted: (_) => _submit(),
                        decoration: InputDecoration(
                          labelText: 'Contraseña',
                          errorText: auth.fieldErrors['password'],
                        ),
                        validator: (value) => (value == null || value.isEmpty) ? 'Ingresa tu contraseña.' : null,
                      ),
                      AnimatedSize(
                        duration: AppDurations.appear,
                        curve: Curves.easeOutCubic,
                        child: message == null
                            ? const SizedBox(width: double.infinity)
                            : Padding(
                                padding: const EdgeInsets.only(top: AppSpacing.lg),
                                child: Text(
                                  message,
                                  style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.danger),
                                ),
                              ),
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      FilledButton(
                        onPressed: auth.loading ? null : _submit,
                        child: auth.loading
                            ? const SizedBox(
                                width: AppSizes.spinnerSmall,
                                height: AppSizes.spinnerSmall,
                                child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.onPrimary),
                              )
                            : const Text('Iniciar sesión'),
                      ),
                    ],
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
