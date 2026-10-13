import 'payment.dart';

/// Línea de un ticket: servicio, mano de obra o refacción.
class TicketLine {
  const TicketLine({required this.description, required this.quantity, required this.unitPrice, required this.amount});

  final String description;
  final int quantity;
  final double unitPrice;
  final double amount;

  factory TicketLine.fromJson(Map<String, dynamic> json) => TicketLine(
        description: json['description'] as String,
        quantity: (json['quantity'] ?? 1) as int,
        unitPrice: ((json['unitPrice'] ?? json['amount']) as num).toDouble(),
        amount: (json['amount'] as num).toDouble(),
      );
}

/// Datos básicos del taller, tomados de la configuración del servidor.
class Workshop {
  const Workshop({required this.name, required this.address, required this.phone});

  final String name;
  final String address;
  final String phone;

  factory Workshop.fromJson(Map<String, dynamic> json) => Workshop(
        name: json['name'] as String,
        address: (json['address'] ?? '') as String,
        phone: (json['phone'] ?? '') as String,
      );
}

/// Comprobante de una orden. Se arma con los datos vigentes de la orden y sus pagos.
class Ticket {
  const Ticket({
    required this.id,
    required this.folio,
    required this.generatedAt,
    required this.generatedByName,
    required this.orderChangedSinceGenerated,
    required this.workshop,
    required this.orderId,
    required this.orderFolio,
    required this.orderStatus,
    required this.clientName,
    required this.clientPhone,
    required this.vehicleDescription,
    required this.licensePlate,
    required this.mileage,
    required this.services,
    required this.labor,
    required this.parts,
    required this.servicesSubtotal,
    required this.laborSubtotal,
    required this.partsSubtotal,
    required this.total,
    required this.payments,
    required this.paymentSummary,
  });

  final int id;
  final String folio;
  final DateTime generatedAt;
  final String generatedByName;
  final bool orderChangedSinceGenerated;
  final Workshop workshop;
  final int orderId;
  final String orderFolio;
  final String orderStatus;
  final String clientName;
  final String clientPhone;
  final String vehicleDescription;
  final String licensePlate;
  final int mileage;
  final List<TicketLine> services;
  final List<TicketLine> labor;
  final List<TicketLine> parts;
  final double servicesSubtotal;
  final double laborSubtotal;
  final double partsSubtotal;
  final double total;
  final List<Payment> payments;
  final PaymentSummary paymentSummary;

  factory Ticket.fromJson(Map<String, dynamic> json) {
    List<TicketLine> lines(String key) => [
          for (final item in (json[key] as List<dynamic>? ?? const []))
            TicketLine.fromJson(item as Map<String, dynamic>),
        ];
    final order = json['order'] as Map<String, dynamic>;
    final client = json['client'] as Map<String, dynamic>;
    final vehicle = json['vehicle'] as Map<String, dynamic>;
    final subtotals = json['subtotals'] as Map<String, dynamic>;
    return Ticket(
      id: json['id'] as int,
      folio: json['folio'] as String,
      generatedAt: DateTime.parse(json['generatedAt'] as String).toLocal(),
      generatedByName: (json['generatedByName'] ?? '') as String,
      orderChangedSinceGenerated: (json['orderChangedSinceGenerated'] ?? false) as bool,
      workshop: Workshop.fromJson(json['workshop'] as Map<String, dynamic>),
      orderId: order['id'] as int,
      orderFolio: order['folio'] as String,
      orderStatus: (order['status'] ?? '') as String,
      clientName: client['name'] as String,
      clientPhone: (client['phone'] ?? '') as String,
      vehicleDescription: vehicle['description'] as String,
      licensePlate: vehicle['licensePlate'] as String,
      mileage: vehicle['mileage'] as int,
      services: lines('services'),
      labor: lines('labor'),
      parts: lines('parts'),
      servicesSubtotal: (subtotals['services'] as num).toDouble(),
      laborSubtotal: (subtotals['labor'] as num).toDouble(),
      partsSubtotal: (subtotals['parts'] as num).toDouble(),
      total: (json['total'] as num).toDouble(),
      payments: [
        for (final item in (json['payments'] as List<dynamic>? ?? const []))
          Payment.fromJson(item as Map<String, dynamic>),
      ],
      paymentSummary: PaymentSummary.fromJson(json['paymentSummary'] as Map<String, dynamic>),
    );
  }
}
