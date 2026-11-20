/// De dónde viene un valor de la configuración (coincide con la API): guardado desde la aplicación, tomado de la
/// configuración del servidor o el predeterminado.
enum SettingSource {
  saved('saved'),
  environment('environment'),
  defaults('default');

  const SettingSource(this.apiValue);

  final String apiValue;

  static SettingSource fromApi(String value) =>
      SettingSource.values.firstWhere((s) => s.apiValue == value, orElse: () => SettingSource.defaults);
}

/// Datos del taller que aparecen en el encabezado del ticket.
class WorkshopSettings {
  const WorkshopSettings({required this.name, required this.address, required this.phone, required this.source});

  final String name;
  final String address;
  final String phone;
  final SettingSource source;

  factory WorkshopSettings.fromJson(Map<String, dynamic> json) => WorkshopSettings(
        name: json['name'] as String,
        address: json['address'] as String,
        phone: json['phone'] as String,
        source: SettingSource.fromApi(json['source'] as String),
      );
}

/// Márgenes de «Próximo» del mantenimiento: días y kilómetros restantes.
class MaintenanceSettings {
  const MaintenanceSettings({required this.soonDays, required this.soonKm, required this.source});

  final int soonDays;
  final int soonKm;
  final SettingSource source;

  factory MaintenanceSettings.fromJson(Map<String, dynamic> json) => MaintenanceSettings(
        soonDays: (json['soonDays'] as num).toInt(),
        soonKm: (json['soonKm'] as num).toInt(),
        source: SettingSource.fromApi(json['source'] as String),
      );
}

/// Configuración vigente del taller (solo administración), con quién y cuándo se guardó por última vez.
class AppSettings {
  const AppSettings({required this.workshop, required this.maintenance, required this.updatedAt, required this.updatedByName});

  final WorkshopSettings workshop;
  final MaintenanceSettings maintenance;
  final DateTime? updatedAt;
  final String? updatedByName;

  factory AppSettings.fromJson(Map<String, dynamic> json) => AppSettings(
        workshop: WorkshopSettings.fromJson(json['workshop'] as Map<String, dynamic>),
        maintenance: MaintenanceSettings.fromJson(json['maintenance'] as Map<String, dynamic>),
        updatedAt: json['updatedAt'] == null ? null : DateTime.parse(json['updatedAt'] as String).toLocal(),
        updatedByName: json['updatedByName'] as String?,
      );
}
