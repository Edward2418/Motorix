import 'vehicle.dart';

class Client {
  const Client({
    required this.id,
    required this.name,
    required this.phone,
    required this.email,
    required this.active,
    required this.vehicleCount,
    this.vehicles = const [],
  });

  final int id;
  final String name;
  final String phone;
  final String? email;
  final bool active;

  /// Vehículos activos del cliente.
  final int vehicleCount;

  /// Todos los vehículos (activos e inactivos). Solo viene en el detalle del cliente.
  final List<Vehicle> vehicles;

  factory Client.fromJson(Map<String, dynamic> json) => Client(
        id: json['id'] as int,
        name: json['name'] as String,
        phone: json['phone'] as String,
        email: json['email'] as String?,
        active: json['active'] as bool,
        vehicleCount: (json['vehicleCount'] ?? 0) as int,
        vehicles: [
          for (final vehicle in (json['vehicles'] as List<dynamic>? ?? const []))
            Vehicle.fromJson(vehicle as Map<String, dynamic>),
        ],
      );
}
