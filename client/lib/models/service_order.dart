import 'payment.dart';
import 'maintenance.dart';

/// Estados de una orden de servicio (coinciden con los de la API).
enum OrderStatus {
  received('RECIBIDO', 'Recibido'),
  diagnosis('DIAGNOSTICO', 'Diagnóstico'),
  inRepair('EN_REPARACION', 'En reparación'),
  waitingPart('ESPERANDO_REFACCION', 'Esperando refacción'),
  finished('TERMINADO', 'Terminado'),
  delivered('ENTREGADO', 'Entregado'),
  cancelled('CANCELADA', 'Cancelada');

  const OrderStatus(this.apiValue, this.label);

  final String apiValue;
  final String label;

  static OrderStatus fromApi(String value) =>
      OrderStatus.values.firstWhere((s) => s.apiValue == value, orElse: () => OrderStatus.received);

  /// ENTREGADO y CANCELADA son finales: la orden queda como historial y no se modifica.
  bool get isFinal => this == delivered || this == cancelled;
}

/// Servicio realizado o línea de mano de obra de una orden.
class OrderLine {
  const OrderLine({required this.id, required this.description, required this.amount});

  final int id;
  final String description;
  final double amount;

  factory OrderLine.fromJson(Map<String, dynamic> json) => OrderLine(
        id: json['id'] as int,
        description: json['description'] as String,
        amount: (json['amount'] as num).toDouble(),
      );
}

/// Refacción usada en una orden: cantidad y precio de venta copiado al agregarla.
class OrderPartLine {
  const OrderPartLine({
    required this.id,
    required this.partId,
    required this.code,
    required this.name,
    required this.quantity,
    required this.unitPrice,
    required this.subtotal,
  });

  final int id;
  final int partId;
  final String code;
  final String name;
  final int quantity;
  final double unitPrice;
  final double subtotal;

  factory OrderPartLine.fromJson(Map<String, dynamic> json) => OrderPartLine(
        id: json['id'] as int,
        partId: json['partId'] as int,
        code: json['code'] as String,
        name: json['name'] as String,
        quantity: json['quantity'] as int,
        unitPrice: (json['unitPrice'] as num).toDouble(),
        subtotal: (json['subtotal'] as num).toDouble(),
      );
}

/// Cambio de estado registrado en el historial de la orden.
class StatusChange {
  const StatusChange({
    required this.fromStatus,
    required this.toStatus,
    required this.changedBy,
    required this.reason,
    required this.changedAt,
  });

  final OrderStatus? fromStatus;
  final OrderStatus toStatus;
  final String changedBy;
  final String? reason;
  final DateTime changedAt;

  factory StatusChange.fromJson(Map<String, dynamic> json) => StatusChange(
        fromStatus: json['fromStatus'] == null ? null : OrderStatus.fromApi(json['fromStatus'] as String),
        toStatus: OrderStatus.fromApi(json['toStatus'] as String),
        changedBy: (json['changedBy'] ?? '') as String,
        reason: json['reason'] as String?,
        changedAt: DateTime.parse(json['changedAt'] as String).toLocal(),
      );
}

/// Orden de servicio. Las listas devuelven solo el resumen; el detalle trae además el resto de campos.
class ServiceOrder {
  const ServiceOrder({
    required this.id,
    required this.folio,
    required this.status,
    required this.clientId,
    required this.clientName,
    required this.vehicleId,
    required this.vehicleLabel,
    required this.mechanicId,
    required this.mechanicName,
    required this.entryMileage,
    required this.total,
    required this.createdAt,
    this.appointmentId,
    this.previousMileage,
    this.mileageCorrectionReason,
    this.reportedProblem = '',
    this.diagnosis,
    this.notes,
    this.recommendations,
    this.cancelReason,
    this.deliveredAt,
    this.services = const [],
    this.labor = const [],
    this.parts = const [],
    this.maintenance = const [],
    this.serviceMileage,
    this.serviceMileageCorrectionReason,
    this.partsTotal = 0,
    this.servicesTotal = 0,
    this.laborTotal = 0,
    this.history = const [],
    this.allowedTransitions = const [],
    this.paymentStatus,
    this.payment,
  });

  final int id;
  final String folio;
  final OrderStatus status;
  final int clientId;
  final String clientName;
  final int vehicleId;
  final String vehicleLabel;
  final int mechanicId;
  final String mechanicName;
  final int entryMileage;
  final double total;
  final DateTime createdAt;
  final int? appointmentId;
  final int? previousMileage;
  final String? mileageCorrectionReason;
  final String reportedProblem;
  final String? diagnosis;
  final String? notes;
  final String? recommendations;
  final String? cancelReason;
  final DateTime? deliveredAt;
  final List<OrderLine> services;
  final List<OrderLine> labor;
  final List<OrderPartLine> parts;

  /// Mantenimientos programados desde esta orden.
  final List<Maintenance> maintenance;

  /// Kilometraje con el que se terminó el servicio (nulo mientras la orden no esté terminada).
  final int? serviceMileage;
  final String? serviceMileageCorrectionReason;
  final double partsTotal;
  final double servicesTotal;
  final double laborTotal;
  final List<StatusChange> history;

  /// Estados a los que el usuario actual puede pasar la orden (el servidor los calcula por rol y propiedad).
  final List<OrderStatus> allowedTransitions;

  /// Estado de pago y resumen: solo los recibe administración y recepción (nulos para el mecánico).
  final OrderPaymentStatus? paymentStatus;
  final PaymentSummary? payment;

  factory ServiceOrder.fromJson(Map<String, dynamic> json) => ServiceOrder(
        id: json['id'] as int,
        folio: json['folio'] as String,
        status: OrderStatus.fromApi(json['status'] as String),
        clientId: json['clientId'] as int,
        clientName: json['clientName'] as String,
        vehicleId: json['vehicleId'] as int,
        vehicleLabel: json['vehicleLabel'] as String,
        mechanicId: json['mechanicId'] as int,
        mechanicName: json['mechanicName'] as String,
        entryMileage: json['entryMileage'] as int,
        total: (json['total'] as num).toDouble(),
        createdAt: DateTime.parse(json['createdAt'] as String).toLocal(),
        appointmentId: json['appointmentId'] as int?,
        previousMileage: json['previousMileage'] as int?,
        mileageCorrectionReason: json['mileageCorrectionReason'] as String?,
        reportedProblem: (json['reportedProblem'] ?? '') as String,
        diagnosis: json['diagnosis'] as String?,
        notes: json['notes'] as String?,
        recommendations: json['recommendations'] as String?,
        cancelReason: json['cancelReason'] as String?,
        deliveredAt: json['deliveredAt'] == null ? null : DateTime.parse(json['deliveredAt'] as String).toLocal(),
        services: [
          for (final line in (json['services'] as List<dynamic>? ?? const []))
            OrderLine.fromJson(line as Map<String, dynamic>),
        ],
        labor: [
          for (final line in (json['labor'] as List<dynamic>? ?? const []))
            OrderLine.fromJson(line as Map<String, dynamic>),
        ],
        parts: [
          for (final line in (json['parts'] as List<dynamic>? ?? const []))
            OrderPartLine.fromJson(line as Map<String, dynamic>),
        ],
        maintenance: [
          for (final item in (json['maintenance'] as List<dynamic>? ?? const []))
            Maintenance.fromJson(item as Map<String, dynamic>),
        ],
        serviceMileage: json['serviceMileage'] as int?,
        serviceMileageCorrectionReason: json['serviceMileageCorrectionReason'] as String?,
        partsTotal: ((json['partsTotal'] ?? 0) as num).toDouble(),
        servicesTotal: ((json['servicesTotal'] ?? 0) as num).toDouble(),
        laborTotal: ((json['laborTotal'] ?? 0) as num).toDouble(),
        history: [
          for (final change in (json['history'] as List<dynamic>? ?? const []))
            StatusChange.fromJson(change as Map<String, dynamic>),
        ],
        allowedTransitions: [
          for (final status in (json['allowedTransitions'] as List<dynamic>? ?? const []))
            OrderStatus.fromApi(status as String),
        ],
        paymentStatus:
            json['paymentStatus'] == null ? null : OrderPaymentStatus.fromApi(json['paymentStatus'] as String),
        payment: json['payment'] == null ? null : PaymentSummary.fromJson(json['payment'] as Map<String, dynamic>),
      );
}
