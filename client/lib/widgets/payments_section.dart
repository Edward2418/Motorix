import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/payment.dart';
import '../providers/payments_provider.dart';
import '../services/api_client.dart';
import '../utils/app_tokens.dart';
import '../utils/formatters.dart';
import 'payment_dialog.dart';
import 'payment_link_dialog.dart';
import 'reason_dialog.dart';
import 'status_badge.dart';
import 'view_states.dart';

/// Pagos de una orden terminada o entregada: resumen (total, cobrado, saldo), historial de pagos y acciones para
/// registrar y cancelar. Solo se muestra a administración y recepción; el servidor vuelve a validar los permisos.
class PaymentsSection extends StatefulWidget {
  const PaymentsSection({super.key, required this.orderId, required this.isAdmin, this.onChanged});

  final int orderId;

  /// Solo administración puede cancelar un pago ya cobrado.
  final bool isAdmin;

  /// Se llama después de registrar o cancelar un pago para que la pantalla refresque la orden.
  final VoidCallback? onChanged;

  @override
  State<PaymentsSection> createState() => _PaymentsSectionState();
}

class _PaymentsSectionState extends State<PaymentsSection> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        final provider = context.read<PaymentsProvider>();
        provider.loadConfig();
        // Al abrir la orden se actualizan en silencio los pagos de Mercado Pago pendientes.
        provider.load(widget.orderId).then((_) async {
          if (mounted && await provider.refreshPendingMercadoPago(widget.orderId)) {
            widget.onChanged?.call();
          }
        });
      }
    });
  }

  void _notify(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
    widget.onChanged?.call();
  }

  Future<void> _register(PaymentsProvider provider, PaymentSummary summary) async {
    Payment? created;
    final saved = await showPaymentDialog(
      context,
      available: summary.available,
      mercadoPagoEnabled: provider.mercadoPagoEnabled,
      onSubmit: (input) async => created = await provider.register(widget.orderId, input),
    );
    if (!saved || !mounted) {
      return;
    }
    if (created!.method == PaymentMethod.mercadoPago) {
      _notify('Pago de Mercado Pago creado. Comparte el enlace con el cliente.');
      await showPaymentLinkDialog(context, created!);
    } else {
      _notify('Pago registrado.');
    }
  }

  Future<void> _refresh(PaymentsProvider provider, Payment payment) async {
    try {
      final result = await provider.refresh(widget.orderId, payment.id);
      if (!mounted) {
        return;
      }
      final message = switch (result.warning) {
        'STILL_PENDING' => 'Mercado Pago todavía no confirma el pago. Inténtalo de nuevo en unos minutos.',
        'EXTERNAL_APPROVED' =>
          'Mercado Pago reporta un cobro aprobado para un pago ya cancelado o rechazado. Revísalo manualmente.',
        _ => result.payment.status == PaymentStatus.paid ? 'Pago cobrado.' : 'Pago ${result.payment.status.label.toLowerCase()}.',
      };
      _notify(message);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  Future<void> _cancel(PaymentsProvider provider, Payment payment) async {
    final reason = await showReasonDialog(
      context,
      title: 'Cancelar pago',
      message: 'Se cancelará el pago de ${formatMoney(payment.amount)} (${payment.method.label}). '
          'Si ya se cobró, la devolución del dinero se hace fuera del sistema.',
      label: 'Motivo de la cancelación',
      confirmLabel: 'Cancelar pago',
    );
    if (reason == null || !mounted) {
      return;
    }
    try {
      await provider.cancel(widget.orderId, payment.id, reason);
      if (mounted) {
        _notify('Pago cancelado.');
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  bool _canCancel(Payment payment) =>
      payment.status == PaymentStatus.pending || (payment.status == PaymentStatus.paid && widget.isAdmin);

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<PaymentsProvider>();
    final summary = provider.summary;
    final theme = Theme.of(context);

    Widget body;
    if (provider.loading && summary == null) {
      body = const Padding(padding: EdgeInsets.all(AppSpacing.xl), child: LoadingState());
    } else if (provider.error != null && summary == null) {
      body = Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: ErrorState(message: provider.error!, onRetry: () => provider.load(widget.orderId)),
      );
    } else if (summary == null) {
      body = const SizedBox.shrink();
    } else {
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Wrap(
              spacing: AppSpacing.xxl,
              runSpacing: AppSpacing.md,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                _Figure('Total', formatMoney(summary.total)),
                _Figure('Cobrado', formatMoney(summary.collected)),
                if (summary.reserved > 0) _Figure('Reservado (pendiente)', formatMoney(summary.reserved)),
                _Figure('Saldo por cobrar', formatMoney(summary.balance)),
                if (summary.creditBalance > 0) _Figure('Saldo a favor', formatMoney(summary.creditBalance)),
                StatusBadge.orderPayment(summary.status),
              ],
            ),
          ),
          const Divider(height: 1),
          if (provider.payments.isEmpty)
            Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Text(
                'Todavía no se registra ningún pago.',
                style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.textSecondary),
              ),
            )
          else
            for (final payment in provider.payments) ...[
              _PaymentRow(
                payment: payment,
                onCancel: _canCancel(payment) ? () => _cancel(provider, payment) : null,
                onRefresh: payment.method == PaymentMethod.mercadoPago && payment.status == PaymentStatus.pending
                    ? () => _refresh(provider, payment)
                    : null,
                onShowLink: payment.paymentLink == null ? null : () => showPaymentLinkDialog(context, payment),
              ),
              const Divider(height: 1),
            ],
        ],
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Text('Pagos', style: theme.textTheme.titleLarge),
              const Spacer(),
              if (summary != null && summary.canCollect)
                OutlinedButton.icon(
                  onPressed: () => _register(provider, summary),
                  icon: const Icon(LucideIcons.banknote, size: AppSizes.icon),
                  label: const Text('Registrar pago'),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Card(clipBehavior: Clip.antiAlias, child: body),
        ],
      ),
    );
  }
}

class _Figure extends StatelessWidget {
  const _Figure(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label, style: theme.textTheme.bodySmall),
        Text(value, style: theme.textTheme.titleMedium),
      ],
    );
  }
}

class _PaymentRow extends StatelessWidget {
  const _PaymentRow({required this.payment, required this.onCancel, this.onRefresh, this.onShowLink});

  final Payment payment;
  final VoidCallback? onCancel;
  final VoidCallback? onRefresh;
  final VoidCallback? onShowLink;

  String _detail() {
    final date = payment.paidAt ?? payment.createdAt;
    final parts = [
      formatDateTime(date),
      payment.createdByName,
      if (payment.reference != null) 'Ref. ${payment.reference}',
      if (payment.status == PaymentStatus.cancelled && payment.cancelReason != null) 'Motivo: ${payment.cancelReason}',
    ];
    return parts.where((part) => part.isNotEmpty).join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final inactive = payment.status == PaymentStatus.cancelled || payment.status == PaymentStatus.rejected;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl, vertical: AppSpacing.sm),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${payment.method.label} · ${formatMoney(payment.amount)}',
                  style: theme.textTheme.bodyLarge?.copyWith(
                    decoration: inactive ? TextDecoration.lineThrough : null,
                    color: inactive ? AppColors.textSecondary : null,
                  ),
                ),
                Text(_detail(), style: theme.textTheme.bodySmall),
              ],
            ),
          ),
          StatusBadge.payment(payment.status),
          if (onShowLink != null)
            IconButton(
              tooltip: 'Ver enlace de pago de ${formatMoney(payment.amount)}',
              onPressed: onShowLink,
              icon: const Icon(LucideIcons.link, size: AppSizes.icon),
            ),
          if (onRefresh != null)
            IconButton(
              tooltip: 'Actualizar estado del pago de ${formatMoney(payment.amount)}',
              onPressed: onRefresh,
              icon: const Icon(LucideIcons.refreshCw, size: AppSizes.icon),
            ),
          if (onCancel != null)
            IconButton(
              tooltip: 'Cancelar pago de ${formatMoney(payment.amount)} (${payment.method.label})',
              onPressed: onCancel,
              icon: const Icon(LucideIcons.ban, size: AppSizes.icon),
            ),
        ],
      ),
    );
  }
}
