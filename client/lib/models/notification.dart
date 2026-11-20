/// Aviso del centro de notificaciones (Sprint 6). Los avisos no se guardan: el servidor los calcula al consultar y aquí
/// solo se muestran. La gravedad es 1 (normal) o 2 (grave: vencido o agotado).
class AppNotification {
  const AppNotification({
    required this.key,
    required this.type,
    required this.severity,
    required this.title,
    required this.detail,
    required this.read,
    required this.targetModule,
    required this.targetId,
  });

  /// Identidad del aviso: `TIPO:id` del objeto concreto (por ejemplo `STOCK:3`).
  final String key;

  /// `MAINTENANCE_SOON`, `MAINTENANCE_OVERDUE`, `APPOINTMENT_TODAY`, `STOCK_LOW`, `STOCK_OUT` u `ORDER_STALE`.
  final String type;
  final int severity;
  final String title;
  final String detail;
  final bool read;

  /// Módulo que abre el aviso: `orders`, `appointments`, `maintenance` o `inventory`.
  final String targetModule;
  final int targetId;

  bool get isGrave => severity >= 2;

  /// Etiqueta de la sección del menú lateral que abre el aviso.
  String get targetLabel => switch (targetModule) {
        'orders' => 'Órdenes de servicio',
        'appointments' => 'Citas',
        'maintenance' => 'Mantenimientos',
        'inventory' => 'Inventario',
        _ => '',
      };

  /// Etiqueta de texto del estado del mantenimiento, para no depender solo del color. Vacía en los demás avisos.
  String get statusLabel => switch (type) {
        'MAINTENANCE_OVERDUE' => 'Vencido',
        'MAINTENANCE_SOON' => 'Próximo',
        _ => '',
      };

  /// La orden que debe abrirse en su detalle, solo para los avisos de órdenes.
  int? get targetOrderId => targetModule == 'orders' ? targetId : null;

  AppNotification copyWith({bool? read}) => AppNotification(
        key: key,
        type: type,
        severity: severity,
        title: title,
        detail: detail,
        read: read ?? this.read,
        targetModule: targetModule,
        targetId: targetId,
      );

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    final target = (json['target'] ?? <String, dynamic>{}) as Map<String, dynamic>;
    return AppNotification(
      key: json['key'] as String,
      type: json['type'] as String,
      severity: (json['severity'] as num).toInt(),
      title: (json['title'] ?? '') as String,
      detail: (json['detail'] ?? '') as String,
      read: (json['read'] ?? false) as bool,
      targetModule: (target['module'] ?? '') as String,
      targetId: ((target['id'] ?? 0) as num).toInt(),
    );
  }
}

/// Grupo de avisos de un mismo tipo. [total] y [unread] son exactos; [items] trae hasta 10 avisos.
class NotificationGroup {
  const NotificationGroup({
    required this.type,
    required this.label,
    required this.total,
    required this.unread,
    required this.items,
  });

  final String type;
  final String label;
  final int total;
  final int unread;
  final List<AppNotification> items;

  /// Cuántos avisos del grupo no caben en [items].
  int get hidden => total - items.length;

  factory NotificationGroup.fromJson(Map<String, dynamic> json) => NotificationGroup(
        type: json['type'] as String,
        label: json['label'] as String,
        total: (json['total'] as num).toInt(),
        unread: (json['unread'] as num).toInt(),
        items: ((json['items'] ?? <dynamic>[]) as List<dynamic>)
            .map((item) => AppNotification.fromJson(item as Map<String, dynamic>))
            .toList(),
      );

  /// Copia del grupo con el aviso [key] marcado como leído (si estaba sin leer, baja el contador del grupo).
  NotificationGroup markedRead(String key) {
    final index = items.indexWhere((item) => item.key == key);
    if (index < 0 || items[index].read) {
      return this;
    }
    final updated = [...items];
    updated[index] = updated[index].copyWith(read: true);
    return NotificationGroup(type: type, label: label, total: total, unread: unread - 1, items: updated);
  }
}

/// Avisos del usuario agrupados por tipo y su total de no leídos.
class NotificationCenter {
  const NotificationCenter({required this.unread, required this.groups});

  final int unread;
  final List<NotificationGroup> groups;

  bool get isEmpty => groups.isEmpty;

  factory NotificationCenter.fromJson(Map<String, dynamic> json) => NotificationCenter(
        unread: (json['unread'] as num).toInt(),
        groups: ((json['groups'] ?? <dynamic>[]) as List<dynamic>)
            .map((group) => NotificationGroup.fromJson(group as Map<String, dynamic>))
            .toList(),
      );

  /// Copia con el aviso [key] marcado como leído y el total de no leídos que informó el servidor.
  NotificationCenter markedRead(String key, int unread) =>
      NotificationCenter(unread: unread, groups: groups.map((group) => group.markedRead(key)).toList());
}
