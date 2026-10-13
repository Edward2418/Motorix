import 'package:flutter/material.dart';

import '../utils/app_tokens.dart';

/// Estado vacío: mensaje útil y, si aplica, una acción sugerida.
class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.message, this.actionLabel, this.onAction});

  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyLarge),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: AppSpacing.lg),
              FilledButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}

/// Estado de carga: indicador de progreso discreto.
class LoadingState extends StatelessWidget {
  const LoadingState({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(AppSpacing.xxl),
        child: SizedBox(
          width: AppSizes.spinner,
          height: AppSizes.spinner,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      ),
    );
  }
}

/// Estado de error: mensaje claro en español y opción de reintentar.
class ErrorState extends StatelessWidget {
  const ErrorState({super.key, required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: AppColors.danger),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: AppSpacing.lg),
              OutlinedButton(onPressed: onRetry, child: const Text('Reintentar')),
            ],
          ],
        ),
      ),
    );
  }
}

/// Mensaje breve de éxito o error (snackbar).
void showFeedback(BuildContext context, String message, {bool error = false}) {
  final messenger = ScaffoldMessenger.of(context);
  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: error ? AppColors.danger : AppColors.textPrimary,
        duration: const Duration(seconds: 4),
      ),
    );
}
