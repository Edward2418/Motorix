import 'package:flutter/material.dart';

import '../models/payment.dart';
import '../providers/payments_provider.dart';
import '../services/api_client.dart';
import '../utils/app_tokens.dart';
import '../utils/formatters.dart';
import 'confirm_dialog.dart';

/// Registra un pago. [available] es lo máximo que se puede cobrar ahora; se propone como importe inicial.
/// Antes de guardar pide confirmación. [onSubmit] llama a la API; si el servidor rechaza los datos, los errores
/// se muestran en los campos sin cerrar el diálogo. Devuelve `true` si se registró el pago.
Future<bool> showPaymentDialog(
  BuildContext context, {
  required double available,
  required Future<void> Function(PaymentInput input) onSubmit,
  bool mercadoPagoEnabled = false,
}) async {
  final saved = await showDialog<bool>(
    context: context,
    builder: (_) => _PaymentDialog(available: available, onSubmit: onSubmit, mercadoPagoEnabled: mercadoPagoEnabled),
  );
  return saved ?? false;
}

class _PaymentDialog extends StatefulWidget {
  const _PaymentDialog({required this.available, required this.onSubmit, required this.mercadoPagoEnabled});

  final double available;
  final Future<void> Function(PaymentInput input) onSubmit;
  final bool mercadoPagoEnabled;

  @override
  State<_PaymentDialog> createState() => _PaymentDialogState();
}

class _PaymentDialogState extends State<_PaymentDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _amount = TextEditingController(text: widget.available.toStringAsFixed(2));
  final _reference = TextEditingController();

  PaymentMethod _method = PaymentMethod.cash;
  bool _saving = false;
  String? _generalError;
  Map<String, String> _serverErrors = const {};

  @override
  void dispose() {
    _amount.dispose();
    _reference.dispose();
    super.dispose();
  }

  String? _validateAmount(String? value) {
    final text = (value ?? '').trim();
    final amount = double.tryParse(text);
    if (amount == null) {
      return 'Escribe un importe numérico.';
    }
    if (amount <= 0) {
      return 'El importe debe ser mayor que cero.';
    }
    if (!RegExp(r'^\d+(\.\d{1,2})?$').hasMatch(text)) {
      return 'El importe admite como máximo dos decimales.';
    }
    if ((amount * 100).round() > (widget.available * 100).round()) {
      return 'El importe supera lo disponible (${formatMoney(widget.available)}).';
    }
    return null;
  }

  Future<void> _submit() async {
    setState(() {
      _generalError = null;
      _serverErrors = const {};
    });
    if (!_formKey.currentState!.validate()) {
      return;
    }
    final amount = double.parse(_amount.text.trim());
    final confirmed = await showConfirmDialog(
      context,
      title: 'Confirmar pago',
      message: 'Se registrará un pago de ${formatMoney(amount)} con ${_method.label}. ¿Deseas continuar?',
    );
    if (!confirmed || !mounted) {
      return;
    }
    setState(() => _saving = true);
    try {
      await widget.onSubmit(PaymentInput(
        amount: amount,
        method: _method,
        reference: _reference.text.trim().isEmpty ? null : _reference.text.trim(),
      ));
      if (mounted) {
        Navigator.of(context).pop(true);
      }
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
    final theme = Theme.of(context);
    return AlertDialog(
      title: const Text('Registrar pago'),
      content: SizedBox(
        width: AppSizes.dialogWidth,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Disponible para cobrar: ${formatMoney(widget.available)}', style: theme.textTheme.bodyMedium),
                const SizedBox(height: AppSpacing.lg),
                TextFormField(
                  controller: _amount,
                  autofocus: true,
                  enabled: !_saving,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(labelText: 'Importe', prefixText: r'$ ', errorText: _serverErrors['amount']),
                  validator: _validateAmount,
                ),
                const SizedBox(height: AppSpacing.lg),
                DropdownButtonFormField<PaymentMethod>(
                  isExpanded: true,
                  initialValue: _method,
                  decoration: InputDecoration(labelText: 'Método de pago', errorText: _serverErrors['method']),
                  items: [
                    for (final method in PaymentMethod.values)
                      DropdownMenuItem(
                        value: method,
                        enabled: method.isManual || widget.mercadoPagoEnabled,
                        child: Text(
                          method.isManual || widget.mercadoPagoEnabled ? method.label : '${method.label} (no configurado)',
                        ),
                      ),
                  ],
                  onChanged: _saving ? null : (value) => setState(() => _method = value ?? _method),
                ),
                const SizedBox(height: AppSpacing.lg),
                TextFormField(
                  controller: _reference,
                  enabled: !_saving,
                  decoration: InputDecoration(
                    labelText: 'Referencia (opcional)',
                    helperText: 'No escribas números de tarjeta: usa solo un número de autorización o de rastreo.',
                    helperMaxLines: 2,
                    errorText: _serverErrors['reference'],
                  ),
                  validator: (value) =>
                      (value?.trim().length ?? 0) > 100 ? 'La referencia no puede tener más de 100 caracteres.' : null,
                ),
                if (_generalError != null) ...[
                  const SizedBox(height: AppSpacing.lg),
                  Text(_generalError!, style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.danger)),
                ],
              ],
            ),
          ),
        ),
      ),
      actions: [
        OutlinedButton(onPressed: _saving ? null : () => Navigator.of(context).pop(false), child: const Text('Cancelar')),
        FilledButton(onPressed: _saving ? null : _submit, child: Text(_saving ? 'Guardando…' : 'Registrar pago')),
      ],
    );
  }
}
