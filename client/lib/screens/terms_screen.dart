import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/terms_provider.dart';
import '../utils/app_tokens.dart';
import '../widgets/view_states.dart';

/// Términos y condiciones y aviso de privacidad. Se muestra después de iniciar sesión, antes de cualquier módulo, mientras
/// la persona no haya aceptado la versión vigente. «Rechazar» cierra la sesión.
class TermsScreen extends StatefulWidget {
  const TermsScreen({super.key});

  @override
  State<TermsScreen> createState() => _TermsScreenState();
}

class _TermsScreenState extends State<TermsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  // Si el servidor dice que no hay ninguna versión publicada, no hay nada que aceptar y se entra a la aplicación.
  Future<void> _load() async {
    final terms = context.read<TermsProvider>();
    final auth = context.read<AuthProvider>();
    await terms.load();
    if (mounted && terms.error == null && terms.current == null) {
      auth.termsAccepted();
    }
  }

  Future<void> _accept() async {
    final auth = context.read<AuthProvider>();
    if (await context.read<TermsProvider>().accept()) {
      auth.termsAccepted();
    }
  }

  @override
  Widget build(BuildContext context) {
    final terms = context.watch<TermsProvider>();
    final theme = Theme.of(context);
    final current = terms.current;

    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: AppSizes.formMaxWidth),
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.xl),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text('Términos y condiciones', style: theme.textTheme.headlineSmall),
                    if (current != null) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text('Versión ${current.version}', style: theme.textTheme.bodySmall),
                    ],
                    const SizedBox(height: AppSpacing.lg),
                    Expanded(child: _body(context, terms)),
                    if (terms.acceptError != null) ...[
                      const SizedBox(height: AppSpacing.md),
                      Text(terms.acceptError!, style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.danger)),
                    ],
                    const SizedBox(height: AppSpacing.lg),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        TextButton(
                          onPressed: terms.saving ? null : () => context.read<AuthProvider>().logout(),
                          child: const Text('Rechazar'),
                        ),
                        if (current != null) ...[
                          const SizedBox(width: AppSpacing.md),
                          FilledButton(
                            onPressed: terms.saving ? null : _accept,
                            child: terms.saving
                                ? const SizedBox(
                                    width: AppSizes.spinnerSmall,
                                    height: AppSizes.spinnerSmall,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.onPrimary),
                                  )
                                : const Text('Aceptar'),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _body(BuildContext context, TermsProvider terms) {
    final theme = Theme.of(context);
    if (terms.loading && terms.current == null) {
      return const LoadingState();
    }
    if (terms.error != null && terms.current == null) {
      return ErrorState(message: terms.error!, onRetry: _load);
    }
    final current = terms.current;
    if (current == null) {
      return const LoadingState();
    }
    return Scrollbar(
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(current.termsText, style: theme.textTheme.bodyMedium),
            const SizedBox(height: AppSpacing.xl),
            Text('Aviso de privacidad', style: theme.textTheme.titleMedium),
            const SizedBox(height: AppSpacing.sm),
            Text(current.privacyText, style: theme.textTheme.bodyMedium),
          ],
        ),
      ),
    );
  }
}
