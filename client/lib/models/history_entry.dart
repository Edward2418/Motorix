import 'service_order.dart';

/// Refacción usada en un servicio del historial.
class HistoryPart {
  const HistoryPart({
    required this.partId,
    required this.code,
    required this.name,
    required this.quantity,
    required this.unitPrice,
  });

  final int partId;
  final String code;
  final String name;
  final int quantity;
  final double unitPrice;

  double get subtotal => quantity * unitPrice;

  factory HistoryPart.fromJson(Map<String, dynamic> json) => HistoryPart(
        partId: json['partId'] as int,
        code: json['code'] as String,
        name: json['name'] as String,
        quantity: json['quantity'] as int,
        unitPrice: (json['unitPrice'] as num).toDouble(),
      );
}

/// Servicio finalizado de un vehículo (orden TERMINADO o ENTREGADO), derivado de las órdenes.
class HistoryEntry {
  const HistoryEntry({
    required this.orderId,
    required this.folio,
    required this.status,
    required this.serviceDate,
    required this.serviceMileage,
    required this.mechanicName,
    required this.reportedProblem,
    required this.total,
    this.diagnosis,
    this.notes,
    this.recommendations,
    this.services = const [],
    this.labor = const [],
    this.parts = const [],
  });

  final int orderId;
  final String folio;
  final OrderStatus status;
  final DateTime serviceDate;
  final int serviceMileage;
  final String mechanicName;
  final String reportedProblem;
  final double total;
  final String? diagnosis;
  final String? notes;
  final String? recommendations;
  final List<OrderLine> services;
  final List<OrderLine> labor;
  final List<HistoryPart> parts;

  factory HistoryEntry.fromJson(Map<String, dynamic> json) {
    // Las líneas del historial no traen identificador propio: solo descripción e importe.
    List<OrderLine> lines(String key) => [
          for (final line in (json[key] as List<dynamic>? ?? const []))
            OrderLine(
              id: 0,
              description: (line as Map<String, dynamic>)['description'] as String,
              amount: (line['amount'] as num).toDouble(),
            ),
        ];
    return HistoryEntry(
      orderId: json['orderId'] as int,
      folio: json['folio'] as String,
      status: OrderStatus.fromApi(json['status'] as String),
      serviceDate: DateTime.parse(json['serviceDate'] as String).toLocal(),
      serviceMileage: json['serviceMileage'] as int,
      mechanicName: (json['mechanicName'] ?? '') as String,
      reportedProblem: (json['reportedProblem'] ?? '') as String,
      total: (json['total'] as num).toDouble(),
      diagnosis: json['diagnosis'] as String?,
      notes: json['notes'] as String?,
      recommendations: json['recommendations'] as String?,
      services: lines('services'),
      labor: lines('labor'),
      parts: [
        for (final part in (json['parts'] as List<dynamic>? ?? const []))
          HistoryPart.fromJson(part as Map<String, dynamic>),
      ],
    );
  }
}

/// Página del historial de un vehículo.
class HistoryPage {
  const HistoryPage({required this.entries, required this.total});

  final List<HistoryEntry> entries;
  final int total;
}
