import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/payment.dart';
import '../models/ticket.dart';
import '../providers/ticket_provider.dart';
import '../services/api_client.dart';
import '../services/ticket_printer.dart';
import '../utils/app_tokens.dart';
import '../utils/formatters.dart';
import '../widgets/status_badge.dart';
import '../widgets/view_states.dart';

/// Ticket de servicio de una orden: se consulta si ya existe y se genera cuando recepción lo pide.
/// El comprobante se ve en pantalla y se imprime con [TicketPrinter]; no se guarda ningún archivo.
class TicketScreen extends StatefulWidget {
  const TicketScreen({super.key, required this.orderId});

  final int orderId;

  @override
  State<TicketScreen> createState() => _TicketScreenState();
}

class _TicketScreenState extends State<TicketScreen> {
  bool _printing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<TicketProvider>().load(widget.orderId));
  }

  void _message(String text) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  Future<void> _generate() async {
    try {
      final ticket = await context.read<TicketProvider>().generate(widget.orderId);
      if (mounted) {
        _message('Ticket ${ticket.folio} generado.');
      }
    } on ApiException catch (e) {
      if (mounted) {
        _message(e.message);
      }
    }
  }

  Future<void> _print(Ticket ticket) async {
    setState(() => _printing = true);
    try {
      await context.read<TicketPrinter>().print(ticket);
    } catch (_) {
      if (mounted) {
        _message('No se pudo abrir la impresión. Revisa la impresora e inténtalo de nuevo.');
      }
    } finally {
      if (mounted) {
        setState(() => _printing = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<TicketProvider>();
    final ticket = provider.ticket;
    return Scaffold(
      appBar: AppBar(
        title: Text(ticket == null ? 'Ticket de servicio' : 'Ticket ${ticket.folio}'),
        backgroundColor: AppColors.surface,
        scrolledUnderElevation: 0,
        actions: [
          if (ticket != null)
            Padding(
              padding: const EdgeInsets.only(right: AppSpacing.lg),
              child: FilledButton.icon(
                onPressed: _printing ? null : () => _print(ticket),
                icon: const Icon(LucideIcons.printer, size: AppSizes.icon),
                label: Text(_printing ? 'Imprimiendo…' : 'Imprimir'),
              ),
            ),
        ],
      ),
      body: _body(provider),
    );
  }

  Widget _body(TicketProvider provider) {
    if (provider.loading) {
      return const LoadingState();
    }
    if (provider.error != null && provider.ticket == null) {
      return ErrorState(message: provider.error!, onRetry: () => provider.load(widget.orderId));
    }
    final ticket = provider.ticket;
    if (ticket == null) {
      return EmptyState(
        message: 'Esta orden todavía no tiene ticket.',
        actionLabel: provider.generating ? 'Generando…' : 'Generar ticket',
        onAction: provider.generating ? null : _generate,
      );
    }
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: AppSizes.ticketWidth),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (ticket.orderChangedSinceGenerated) const _ChangedBanner(),
              _TicketCard(ticket: ticket),
            ],
          ),
        ),
      ),
    );
  }
}

class _ChangedBanner extends StatelessWidget {
  const _ChangedBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.lg),
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.warning.withValues(alpha: 0.1),
        border: Border.all(color: AppColors.warning.withValues(alpha: 0.4)),
        borderRadius: BorderRadius.circular(AppRadius.panel),
      ),
      child: Row(
        children: [
          const Icon(LucideIcons.triangleAlert, size: AppSizes.icon, color: AppColors.warning),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              'La orden se modificó después de generar este ticket. Se muestran los datos vigentes.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ],
      ),
    );
  }
}

class _TicketCard extends StatelessWidget {
  const _TicketCard({required this.ticket});

  final Ticket ticket;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(ticket.workshop.name, style: theme.textTheme.titleLarge, textAlign: TextAlign.center),
            if (ticket.workshop.address.isNotEmpty)
              Text(ticket.workshop.address, style: theme.textTheme.bodySmall, textAlign: TextAlign.center),
            if (ticket.workshop.phone.isNotEmpty)
              Text('Tel. ${ticket.workshop.phone}', style: theme.textTheme.bodySmall, textAlign: TextAlign.center),
            const Divider(height: AppSpacing.xxl),
            _Pair('Ticket', ticket.folio),
            _Pair('Orden', ticket.orderFolio),
            _Pair('Fecha', formatDateTime(ticket.generatedAt)),
            _Pair('Cliente', ticket.clientName),
            if (ticket.clientPhone.isNotEmpty) _Pair('Teléfono', ticket.clientPhone),
            _Pair('Vehículo', '${ticket.vehicleDescription} (${ticket.licensePlate})'),
            _Pair('Kilometraje', formatMileage(ticket.mileage)),
            const Divider(height: AppSpacing.xxl),
            _Lines('Servicios', ticket.services, ticket.servicesSubtotal),
            _Lines('Mano de obra', ticket.labor, ticket.laborSubtotal),
            _Lines('Refacciones', ticket.parts, ticket.partsSubtotal, withQuantity: true),
            const Divider(height: AppSpacing.xxl),
            Row(
              children: [
                Text('Total', style: theme.textTheme.titleLarge),
                const Spacer(),
                Text(formatMoney(ticket.total), style: theme.textTheme.titleLarge),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            Text('Pagos', style: theme.textTheme.titleMedium),
            if (ticket.payments.isEmpty)
              Text('Sin pagos registrados.', style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.textSecondary))
            else
              for (final payment in ticket.payments)
                _Pair(
                  payment.status == PaymentStatus.pending ? '${payment.method.label} (pendiente)' : payment.method.label,
                  formatMoney(payment.amount),
                ),
            _Pair('Cobrado', formatMoney(ticket.paymentSummary.collected)),
            _Pair('Saldo por cobrar', formatMoney(ticket.paymentSummary.balance)),
            Align(
              alignment: Alignment.centerLeft,
              child: Padding(
                padding: const EdgeInsets.only(top: AppSpacing.sm),
                child: StatusBadge.orderPayment(ticket.paymentSummary.status),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Pair extends StatelessWidget {
  const _Pair(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: AppSizes.ticketLabelWidth, child: Text(label, style: theme.textTheme.bodySmall)),
          Expanded(child: Text(value, style: theme.textTheme.bodyMedium)),
        ],
      ),
    );
  }
}

class _Lines extends StatelessWidget {
  const _Lines(this.title, this.lines, this.subtotal, {this.withQuantity = false});

  final String title;
  final List<TicketLine> lines;
  final double subtotal;
  final bool withQuantity;

  @override
  Widget build(BuildContext context) {
    if (lines.isEmpty) {
      return const SizedBox.shrink();
    }
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: theme.textTheme.titleMedium),
          for (final line in lines)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      withQuantity ? '${line.quantity} × ${line.description} (${formatMoney(line.unitPrice)})' : line.description,
                      style: theme.textTheme.bodyMedium,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Text(formatMoney(line.amount), style: theme.textTheme.bodyMedium),
                ],
              ),
            ),
          Row(
            children: [
              Text('Subtotal de ${title.toLowerCase()}', style: theme.textTheme.bodySmall),
              const Spacer(),
              Text(formatMoney(subtotal), style: theme.textTheme.bodySmall),
            ],
          ),
        ],
      ),
    );
  }
}
