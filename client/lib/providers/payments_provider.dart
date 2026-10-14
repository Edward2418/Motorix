import 'package:flutter/foundation.dart';

import '../models/payment.dart';
import '../services/api_client.dart';

/// Datos de un pago nuevo. Nunca incluye datos de tarjeta: solo importe, método y una referencia opcional.
class PaymentInput {
  const PaymentInput({required this.amount, required this.method, this.reference});

  final double amount;
  final PaymentMethod method;
  final String? reference;
}

/// Resultado de actualizar un pago de Mercado Pago: el pago y un aviso opcional (`STILL_PENDING` o `EXTERNAL_APPROVED`).
class RefreshResult {
  const RefreshResult({required this.payment, this.warning});

  final Payment payment;
  final String? warning;
}

/// Pagos de la orden abierta en pantalla: lista, resumen, registro y cancelación.
class PaymentsProvider extends ChangeNotifier {
  PaymentsProvider(this._api);

  final ApiClient _api;

  int? _orderId;
  List<Payment> _payments = const [];
  PaymentSummary? _summary;
  bool _loading = false;
  String? _error;
  bool _mercadoPagoEnabled = false;

  /// Mercado Pago solo se ofrece si el servidor tiene credenciales configuradas.
  bool get mercadoPagoEnabled => _mercadoPagoEnabled;

  List<Payment> get payments => _payments;
  PaymentSummary? get summary => _summary;
  bool get loading => _loading;
  String? get error => _error;

  /// Consulta qué métodos ofrece el servidor. Si falla, Mercado Pago queda deshabilitado.
  Future<void> loadConfig() async {
    try {
      final response = await _api.get('/payments/config');
      _mercadoPagoEnabled = ((response['data'] as Map<String, dynamic>)['mercadoPagoEnabled'] ?? false) as bool;
    } catch (_) {
      _mercadoPagoEnabled = false;
    }
    notifyListeners();
  }

  /// Carga los pagos de la orden. Si se vuelve a llamar con la misma orden, no oculta la lista mientras actualiza.
  Future<void> load(int orderId) async {
    if (_orderId != orderId) {
      _payments = const [];
      _summary = null;
    }
    _orderId = orderId;
    _loading = _summary == null;
    _error = null;
    notifyListeners();
    try {
      final response = await _api.get('/orders/$orderId/payments');
      _apply(OrderPayments.fromJson(response['data'] as Map<String, dynamic>));
    } on ApiException catch (e) {
      _error = e.message;
    } catch (_) {
      _error = 'El servidor devolvió una respuesta inesperada.';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  void _apply(OrderPayments data) {
    _payments = data.payments;
    _summary = data.summary;
  }

  /// Aplica la respuesta de una operación sobre un pago ({ payment, summary }) y vuelve a pedir la lista.
  Future<void> _afterChange(int orderId) => load(orderId);

  /// Registra un pago. Lanza [ApiException] con los errores por campo si el servidor lo rechaza.
  Future<Payment> register(int orderId, PaymentInput input) async {
    final response = await _api.post('/orders/$orderId/payments', body: {
      'amount': input.amount,
      'method': input.method.apiValue,
      if (input.reference != null && input.reference!.isNotEmpty) 'reference': input.reference,
    });
    final payment = Payment.fromJson((response['data'] as Map<String, dynamic>)['payment'] as Map<String, dynamic>);
    await _afterChange(orderId);
    return payment;
  }

  /// Consulta a Mercado Pago el estado de un pago y vuelve a cargar la lista. Lanza [ApiException] si falla.
  Future<RefreshResult> refresh(int orderId, int paymentId) async {
    final response = await _api.post('/payments/$paymentId/refresh');
    final data = response['data'] as Map<String, dynamic>;
    final result = RefreshResult(
      payment: Payment.fromJson(data['payment'] as Map<String, dynamic>),
      warning: data['warning'] as String?,
    );
    await _afterChange(orderId);
    return result;
  }

  /// Al abrir una orden, actualiza en silencio los pagos de Mercado Pago pendientes. Devuelve `true` si alguno cambió.
  /// Los errores se ignoran: el usuario puede actualizar a mano desde cada pago.
  Future<bool> refreshPendingMercadoPago(int orderId) async {
    var changed = false;
    for (final payment in _payments.where((p) => p.method == PaymentMethod.mercadoPago && p.status == PaymentStatus.pending)) {
      try {
        final response = await _api.post('/payments/${payment.id}/refresh');
        final status = ((response['data'] as Map<String, dynamic>)['payment'] as Map<String, dynamic>)['status'] as String;
        changed = changed || PaymentStatus.fromApi(status) != PaymentStatus.pending;
      } catch (_) {
        // Se ignora: no debe impedir ver la orden.
      }
    }
    if (changed) {
      await load(orderId);
    }
    return changed;
  }

  /// Cancela un pago con motivo. Lanza [ApiException] si el servidor lo rechaza.
  Future<void> cancel(int orderId, int paymentId, String reason) async {
    await _api.post('/payments/$paymentId/cancel', body: {'reason': reason});
    await _afterChange(orderId);
  }
}
