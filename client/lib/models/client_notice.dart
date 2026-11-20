/// Motivo por el que hay que avisar a un cliente (coincide con la API).
enum NoticeReason {
  finishedOrder('ORDEN_TERMINADA', 'Orden terminada'),
  appointmentTomorrow('CITA_MANANA', 'Cita de mañana'),
  maintenanceSoon('MANTENIMIENTO_PROXIMO', 'Mantenimiento próximo'),
  maintenanceOverdue('MANTENIMIENTO_VENCIDO', 'Mantenimiento vencido');

  const NoticeReason(this.apiValue, this.label);

  final String apiValue;
  final String label;

  static NoticeReason fromApi(String value) =>
      NoticeReason.values.firstWhere((r) => r.apiValue == value, orElse: () => NoticeReason.finishedOrder);
}

/// Hecho vigente que todavía no se avisó al cliente (orden terminada sin entregar, cita de mañana o mantenimiento
/// próximo o vencido). Se calcula en el servidor al consultar.
class PendingClientNotice {
  const PendingClientNotice({
    required this.reason,
    required this.factKey,
    required this.clientId,
    required this.clientName,
    required this.phone,
    required this.vehicleLabel,
    required this.detail,
    required this.date,
  });

  final NoticeReason reason;

  /// Identidad del hecho: `ORDER:41`, `APPT:7` o `MAINT:12`.
  final String factKey;
  final int clientId;
  final String clientName;

  /// Teléfono del cliente, o «Sin teléfono» si llegara vacío.
  final String phone;
  final String vehicleLabel;
  final String detail;
  final DateTime? date;

  factory PendingClientNotice.fromJson(Map<String, dynamic> json) => PendingClientNotice(
        reason: NoticeReason.fromApi(json['reason'] as String),
        factKey: json['factKey'] as String,
        clientId: (json['clientId'] as num).toInt(),
        clientName: json['clientName'] as String,
        phone: (json['phone'] ?? 'Sin teléfono') as String,
        vehicleLabel: (json['vehicleLabel'] ?? '') as String,
        detail: (json['detail'] ?? '') as String,
        date: json['date'] == null ? null : DateTime.parse(json['date'] as String).toLocal(),
      );
}

/// Registro de que se avisó a un cliente: quién y cuándo.
class ClientNotice {
  const ClientNotice({
    required this.id,
    required this.reason,
    required this.factKey,
    required this.clientId,
    required this.note,
    required this.notifiedBy,
    required this.notifiedByName,
    required this.notifiedAt,
  });

  final int id;
  final NoticeReason reason;
  final String factKey;
  final int clientId;
  final String? note;
  final int notifiedBy;
  final String notifiedByName;
  final DateTime notifiedAt;

  factory ClientNotice.fromJson(Map<String, dynamic> json) => ClientNotice(
        id: (json['id'] as num).toInt(),
        reason: NoticeReason.fromApi(json['reason'] as String),
        factKey: json['factKey'] as String,
        clientId: (json['clientId'] as num).toInt(),
        note: json['note'] as String?,
        notifiedBy: (json['notifiedBy'] as num).toInt(),
        notifiedByName: (json['notifiedByName'] ?? '') as String,
        notifiedAt: DateTime.parse(json['notifiedAt'] as String).toLocal(),
      );
}
