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
    this.servicesTotal = 0,
    this.laborTotal = 0,
    this.history = const [],
    this.allowedTransitions = const [],
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
  final double servicesTotal;
  final double laborTotal;
  final List<StatusChange> history;

  /// Estados a los que el usuario actual puede pasar la orden (el servidor los calcula por rol y propiedad).
  final List<OrderStatus> allowedTransitions;

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
      );
}
