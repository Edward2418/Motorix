class Vehicle {
  const Vehicle({
    required this.id,
    required this.clientId,
    required this.clientName,
    required this.brand,
    required this.model,
    required this.year,
    required this.licensePlate,
    required this.vin,
    required this.currentMileage,
    required this.active,
  });

  final int id;
  final int clientId;
  final String clientName;
  final String brand;
  final String model;
  final int year;
  final String licensePlate;
  final String? vin;
  final int currentMileage;
  final bool active;

  String get description => '$brand $model $year';

  factory Vehicle.fromJson(Map<String, dynamic> json) => Vehicle(
        id: json['id'] as int,
        clientId: json['clientId'] as int,
        clientName: (json['clientName'] ?? '') as String,
        brand: json['brand'] as String,
        model: json['model'] as String,
        year: json['year'] as int,
        licensePlate: json['licensePlate'] as String,
        vin: json['vin'] as String?,
        currentMileage: (json['currentMileage'] ?? 0) as int,
        active: json['active'] as bool,
      );
}
