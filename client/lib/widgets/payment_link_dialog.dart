import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../models/payment.dart';
import '../utils/app_tokens.dart';
import '../utils/formatters.dart';

/// Muestra el enlace de pago de Mercado Pago de [payment] para compartirlo con el cliente. No abre el navegador:
/// el enlace se copia al portapapeles.
Future<void> showPaymentLinkDialog(BuildContext context, Payment payment) {
  return showDialog<void>(context: context, builder: (_) => _PaymentLinkDialog(payment: payment));
}

class _PaymentLinkDialog extends StatefulWidget {
  const _PaymentLinkDialog({required this.payment});

  final Payment payment;

  @override
  State<_PaymentLinkDialog> createState() => _PaymentLinkDialogState();
}

class _PaymentLinkDialogState extends State<_PaymentLinkDialog> {
  bool _copied = false;

  Future<void> _copy() async {
    await Clipboard.setData(ClipboardData(text: widget.payment.paymentLink ?? ''));
    if (mounted) {
      setState(() => _copied = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final payment = widget.payment;
    return AlertDialog(
      title: const Text('Enlace de pago de Mercado Pago'),
      content: SizedBox(
        width: AppSizes.dialogWidth,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Comparte este enlace con el cliente para que pague ${formatMoney(payment.amount)}. '
              'Cuando pague, usa «Actualizar estado» en el pago para registrar el cobro.',
              style: theme.textTheme.bodyMedium,
            ),
            const SizedBox(height: AppSpacing.lg),
            SelectableText(payment.paymentLink ?? 'Sin enlace disponible.', style: theme.textTheme.bodySmall),
            if (payment.expiresAt != null) ...[
              const SizedBox(height: AppSpacing.md),
              Text('Vence el ${formatDateTime(payment.expiresAt!)}.', style: theme.textTheme.bodySmall),
            ],
            if (_copied) ...[
              const SizedBox(height: AppSpacing.md),
              Text('Enlace copiado.', style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.success)),
            ],
          ],
        ),
      ),
      actions: [
        OutlinedButton.icon(
          onPressed: payment.paymentLink == null ? null : _copy,
          icon: const Icon(LucideIcons.copy, size: AppSizes.icon),
          label: const Text('Copiar enlace'),
        ),
        FilledButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cerrar')),
      ],
    );
  }
}
