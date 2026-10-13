/// Ciclo de vida de un mantenimiento programado (coincide con la API).
enum MaintenanceStatus {
  scheduled('PROGRAMADO', 'Programado'),
  fulfilled('ATENDIDO', 'Atendido'),
  cancelled('CANCELADO', 'Cancelado');

  const MaintenanceStatus(this.apiValue, this.label);

  final String apiValue;
  final String label;

  static MaintenanceStatus fromApi(String value) =>
      MaintenanceStatus.values.firstWhere((s) => s.apiValue == value, orElse: () => MaintenanceStatus.scheduled);
}

/// Estado visual de un mantenimiento programado, calculado por el servidor al consultar.
enum MaintenanceVisualStatus {
  normal('NORMAL', 'Normal'),
  soon('PROXIMO', 'Próximo'),
  overdue('VENCIDO', 'Vencido');

  const MaintenanceVisualStatus(this.apiValue, this.label);

  final String apiValue;
  final String label;

  static MaintenanceVisualStatus fromApi(String value) => MaintenanceVisualStatus.values
      .firstWhere((s) => s.apiValue == value, orElse: () => MaintenanceVisualStatus.normal);
}

/// Próximo mantenimiento de un vehículo, por fecha, por kilometraje o por ambos.
class Maintenance {
  const Maintenance({
    required this.id,
    required this.vehicleId,
    required this.vehicleLabel,
    required this.currentMileage,
    required this.clientId,
    required this.clientName,
    required this.clientPhone,
    required this.orderId,
    required this.orderFolio,
    required this.description,
    required this.status,
    required this.createdAt,
    this.dueDate,
    this.dueMileage,
    this.notes,
    this.visualStatus,
    this.remainingDays,
    this.remainingKm,
    this.cancelReason,
    this.fulfilledOrderId,
    this.closedAt,
  });

  final int id;
  final int vehicleId;
  final String vehicleLabel;
  final int currentMileage;
  final int clientId;
  final String clientName;
  final String clientPhone;
  final int orderId;
  final String orderFolio;
  final String description;
  final MaintenanceStatus status;
  final DateTime createdAt;
  final DateTime? dueDate;
  final int? dueMileage;
  final String? notes;

  /// Solo para los mantenimientos PROGRAMADO.
  final MaintenanceVisualStatus? visualStatus;
  final int? remainingDays;
  final int? remainingKm;
  final String? cancelReason;
  final int? fulfilledOrderId;
  final DateTime? closedAt;

  factory Maintenance.fromJson(Map<String, dynamic> json) => Maintenance(
        id: json['id'] as int,
        vehicleId: json['vehicleId'] as int,
        vehicleLabel: (json['vehicleLabel'] ?? '') as String,
        currentMileage: (json['currentMileage'] ?? 0) as int,
        clientId: json['clientId'] as int,
        clientName: (json['clientName'] ?? '') as String,
        clientPhone: (json['clientPhone'] ?? '') as String,
        orderId: json['orderId'] as int,
        orderFolio: (json['orderFolio'] ?? '') as String,
        description: json['description'] as String,
        status: MaintenanceStatus.fromApi(json['status'] as String),
        createdAt: DateTime.parse(json['createdAt'] as String).toLocal(),
        dueDate: json['dueDate'] == null ? null : DateTime.parse(json['dueDate'] as String),
        dueMileage: json['dueMileage'] as int?,
        notes: json['notes'] as String?,
        visualStatus:
            json['visualStatus'] == null ? null : MaintenanceVisualStatus.fromApi(json['visualStatus'] as String),
        remainingDays: json['remainingDays'] as int?,
        remainingKm: json['remainingKm'] as int?,
        cancelReason: json['cancelReason'] as String?,
        fulfilledOrderId: json['fulfilledOrderId'] as int?,
        closedAt: json['closedAt'] == null ? null : DateTime.parse(json['closedAt'] as String).toLocal(),
      );
}
