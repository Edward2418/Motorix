import '../utils/formatters.dart';

/// Tipo de servicio del catálogo, con su intervalo de mantenimiento (en días, en kilómetros o en ambos).
class ServiceType {
  const ServiceType({
    required this.id,
    required this.name,
    required this.intervalDays,
    required this.intervalKm,
    required this.active,
  });

  factory ServiceType.fromJson(Map<String, dynamic> json) => ServiceType(
        id: json['id'] as int,
        name: json['name'] as String,
        intervalDays: json['intervalDays'] as int?,
        intervalKm: json['intervalKm'] as int?,
        active: json['active'] as bool,
      );

  final int id;
  final String name;
  final int? intervalDays;
  final int? intervalKm;
  final bool active;

  /// Intervalo en días para la tabla (`180 días`) o un guion si el tipo no lo tiene.
  String get daysText => intervalDays == null ? '—' : '${formatQuantity(intervalDays!)} ${intervalDays == 1 ? 'día' : 'días'}';

  /// Intervalo en kilómetros para la tabla (`5,000 km`) o un guion si el tipo no lo tiene.
  String get kmText => intervalKm == null ? '—' : '${formatQuantity(intervalKm!)} km';
}

/// Propuesta del próximo mantenimiento a partir de un tipo de servicio usado en la orden. La persona puede corregirla.
class MaintenanceSuggestion {
  const MaintenanceSuggestion({
    required this.serviceTypeId,
    required this.serviceTypeName,
    required this.description,
    required this.dueDate,
    required this.dueMileage,
  });

  factory MaintenanceSuggestion.fromJson(Map<String, dynamic> json) {
    final date = json['dueDate'] as String?;
    return MaintenanceSuggestion(
      serviceTypeId: json['serviceTypeId'] as int,
      serviceTypeName: json['serviceTypeName'] as String,
      description: json['description'] as String,
      dueDate: date == null ? null : DateTime.parse(date),
      dueMileage: json['dueMileage'] as int?,
    );
  }

  final int serviceTypeId;
  final String serviceTypeName;
  final String description;
  final DateTime? dueDate;
  final int? dueMileage;
}
