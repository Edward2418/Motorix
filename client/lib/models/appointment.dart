/// Estados de una cita (coinciden con los de la API).
enum AppointmentStatus {
  pending('PENDIENTE', 'Pendiente'),
  confirmed('CONFIRMADA', 'Confirmada'),
  inProgress('EN_PROCESO', 'En proceso'),
  completed('COMPLETADA', 'Completada'),
  cancelled('CANCELADA', 'Cancelada');

  const AppointmentStatus(this.apiValue, this.label);

  final String apiValue;
  final String label;

  static AppointmentStatus fromApi(String value) =>
      AppointmentStatus.values.firstWhere((s) => s.apiValue == value, orElse: () => AppointmentStatus.pending);

  /// Se puede modificar y confirmar mientras esté pendiente o confirmada.
  bool get editable => this == pending || this == confirmed;
}

class Appointment {
  const Appointment({
    required this.id,
    required this.clientId,
    required this.clientName,
    required this.vehicleId,
    required this.vehicleLabel,
    required this.scheduledAt,
    required this.reason,
    required this.notes,
    required this.status,
    required this.cancelReason,
    required this.orderId,
    required this.orderFolio,
  });

  final int id;
  final int clientId;
  final String clientName;
  final int vehicleId;
  final String vehicleLabel;
  final DateTime scheduledAt;
  final String reason;
  final String? notes;
  final AppointmentStatus status;
  final String? cancelReason;
  final int? orderId;
  final String? orderFolio;

  factory Appointment.fromJson(Map<String, dynamic> json) => Appointment(
        id: json['id'] as int,
        clientId: json['clientId'] as int,
        clientName: json['clientName'] as String,
        vehicleId: json['vehicleId'] as int,
        vehicleLabel: json['vehicleLabel'] as String,
        scheduledAt: DateTime.parse(json['scheduledAt'] as String).toLocal(),
        reason: json['reason'] as String,
        notes: json['notes'] as String?,
        status: AppointmentStatus.fromApi(json['status'] as String),
        cancelReason: json['cancelReason'] as String?,
        orderId: json['orderId'] as int?,
        orderFolio: json['orderFolio'] as String?,
      );
}
