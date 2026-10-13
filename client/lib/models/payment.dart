/// Métodos de pago (coinciden con la API).
enum PaymentMethod {
  cash('EFECTIVO', 'Efectivo'),
  card('TARJETA', 'Tarjeta'),
  transfer('TRANSFERENCIA', 'Transferencia'),
  mercadoPago('MERCADO_PAGO', 'Mercado Pago');

  const PaymentMethod(this.apiValue, this.label);

  final String apiValue;
  final String label;

  static PaymentMethod fromApi(String value) =>
      PaymentMethod.values.firstWhere((m) => m.apiValue == value, orElse: () => PaymentMethod.cash);

  /// Efectivo, tarjeta (terminal externa) y transferencia se registran ya cobrados.
  bool get isManual => this != mercadoPago;
}

/// Estados de un pago.
enum PaymentStatus {
  pending('PENDIENTE', 'Pendiente'),
  paid('PAGADO', 'Pagado'),
  rejected('RECHAZADO', 'Rechazado'),
  cancelled('CANCELADO', 'Cancelado');

  const PaymentStatus(this.apiValue, this.label);

  final String apiValue;
  final String label;

  static PaymentStatus fromApi(String value) =>
      PaymentStatus.values.firstWhere((s) => s.apiValue == value, orElse: () => PaymentStatus.pending);
}

/// Estado de pago de una orden, calculado por el servidor.
enum OrderPaymentStatus {
  none('SIN_PAGO', 'Sin pago'),
  partial('PARCIAL', 'Pago parcial'),
  paid('PAGADA', 'Pagada');

  const OrderPaymentStatus(this.apiValue, this.label);

  final String apiValue;
  final String label;

  static OrderPaymentStatus fromApi(String value) =>
      OrderPaymentStatus.values.firstWhere((s) => s.apiValue == value, orElse: () => OrderPaymentStatus.none);
}

/// Pago de una orden. Nunca contiene datos de tarjeta.
class Payment {
  const Payment({
    required this.id,
    required this.orderId,
    required this.amount,
    required this.method,
    required this.status,
    required this.createdAt,
    this.orderFolio = '',
    this.reference,
    this.paymentLink,
    this.expiresAt,
    this.paidAt,
    this.cancelReason,
    this.createdByName = '',
    this.cancelledByName,
  });

  final int id;
  final int orderId;
  final String orderFolio;
  final double amount;
  final PaymentMethod method;
  final PaymentStatus status;
  final String? reference;
  final String? paymentLink;
  final DateTime? expiresAt;
  final DateTime? paidAt;
  final String? cancelReason;
  final String createdByName;
  final String? cancelledByName;
  final DateTime createdAt;

  factory Payment.fromJson(Map<String, dynamic> json) => Payment(
        id: json['id'] as int,
        orderId: json['orderId'] as int,
        orderFolio: (json['orderFolio'] ?? '') as String,
        amount: (json['amount'] as num).toDouble(),
        method: PaymentMethod.fromApi(json['method'] as String),
        status: PaymentStatus.fromApi(json['status'] as String),
        reference: json['reference'] as String?,
        paymentLink: json['paymentLink'] as String?,
        expiresAt: json['expiresAt'] == null ? null : DateTime.parse(json['expiresAt'] as String).toLocal(),
        paidAt: json['paidAt'] == null ? null : DateTime.parse(json['paidAt'] as String).toLocal(),
        cancelReason: json['cancelReason'] as String?,
        createdByName: (json['createdByName'] ?? '') as String,
        cancelledByName: json['cancelledByName'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String).toLocal(),
      );
}

/// Resumen de pagos de una orden: total, cobrado, reservado, saldo y lo disponible para nuevos pagos.
class PaymentSummary {
  const PaymentSummary({
    required this.total,
    required this.collected,
    required this.reserved,
    required this.balance,
    required this.available,
    required this.creditBalance,
    required this.status,
  });

  final double total;
  final double collected;
  final double reserved;
  final double balance;
  final double available;
  final double creditBalance;
  final OrderPaymentStatus status;

  factory PaymentSummary.fromJson(Map<String, dynamic> json) => PaymentSummary(
        total: (json['total'] as num).toDouble(),
        collected: (json['collected'] as num).toDouble(),
        reserved: (json['reserved'] as num).toDouble(),
        balance: (json['balance'] as num).toDouble(),
        available: (json['available'] as num).toDouble(),
        creditBalance: ((json['creditBalance'] ?? 0) as num).toDouble(),
        status: OrderPaymentStatus.fromApi(json['status'] as String),
      );

  /// Hay algo que cobrar ahora mismo (y la orden admite nuevos pagos).
  bool get canCollect => available > 0;
}

/// Pagos de una orden junto con su resumen.
class OrderPayments {
  const OrderPayments({required this.payments, required this.summary});

  final List<Payment> payments;
  final PaymentSummary summary;

  factory OrderPayments.fromJson(Map<String, dynamic> json) => OrderPayments(
        payments: [
          for (final item in (json['payments'] as List<dynamic>? ?? const []))
            Payment.fromJson(item as Map<String, dynamic>),
        ],
        summary: PaymentSummary.fromJson(json['summary'] as Map<String, dynamic>),
      );
}
