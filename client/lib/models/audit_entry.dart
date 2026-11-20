/// Un registro de la bitácora de acciones sensibles. Solo se consulta: la aplicación no edita ni borra registros.
class AuditEntry {
  const AuditEntry({
    required this.id,
    required this.userId,
    required this.actor,
    required this.action,
    required this.entity,
    required this.entityId,
    required this.detail,
    required this.createdAt,
  });

  factory AuditEntry.fromJson(Map<String, dynamic> json) => AuditEntry(
        id: json['id'] as int,
        userId: json['userId'] as int?,
        actor: json['actor'] as String?,
        action: json['action'] as String,
        entity: json['entity'] as String?,
        entityId: json['entityId'] as int?,
        detail: json['detail'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String).toLocal(),
      );

  final int id;

  /// Cuenta que realizó la acción; `null` si no se conoce (por ejemplo, un inicio fallido de una cuenta inexistente).
  final int? userId;
  final String? actor;
  final String action;
  final String? entity;
  final int? entityId;
  final String? detail;
  final DateTime createdAt;

  /// Nombre de la acción para mostrarlo; si el servidor agrega una nueva, se muestra su código.
  String get actionLabel => auditActionLabels[action] ?? action;
}

/// Acciones que registra el servidor, con su nombre en español (el orden es el del filtro).
const Map<String, String> auditActionLabels = {
  'LOGIN_FAILED': 'Inicio de sesión fallido',
  'ACCOUNT_LOCKED': 'Cuenta bloqueada',
  'USER_CREATED': 'Usuario creado',
  'USER_ACTIVATED': 'Usuario reactivado',
  'USER_DEACTIVATED': 'Usuario desactivado',
  'USER_ROLE_CHANGED': 'Cambio de rol',
  'SETTINGS_CHANGED': 'Cambio de configuración',
  'PART_PRICE_CHANGED': 'Cambio de precio de refacción',
  'PAYMENT_CANCELLED': 'Pago cancelado',
};
