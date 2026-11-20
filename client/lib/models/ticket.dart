import '../utils/formatters.dart';
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

/// Próximo servicio que indica un ticket nuevo: fecha, kilometraje o ambos. Un ticket emitido no lo cambia.
class NextService {
  const NextService({required this.dueDate, required this.dueMileage});

  /// Texto para el ticket, por ejemplo «19 may 2027 · 47,000 km»; solo las partes que existen.
  String get text => [
        if (dueDate != null) formatDate(dueDate!),
        if (dueMileage != null) formatMileage(dueMileage!),
      ].join(' · ');

  factory NextService.fromJson(Map<String, dynamic> json) {
    final date = json['dueDate'] as String?;
    return NextService(
      dueDate: date == null ? null : DateTime.parse(date),
      dueMileage: json['dueMileage'] as int?,
    );
  }

  final DateTime? dueDate;
  final int? dueMileage;
}

/// Comprobante de una orden. Un ticket emitido desde el Sprint 5 trae el contenido que se guardó al emitirlo; el de antes
/// del sprint se arma con los datos vigentes. En ambos casos los pagos y su estado son vigentes.
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
    this.nextService,
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

  /// Solo los tickets nuevos de órdenes con un tipo de servicio con intervalo lo traen.
  final NextService? nextService;

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
      nextService: json['nextService'] is Map<String, dynamic> ? NextService.fromJson(json['nextService'] as Map<String, dynamic>) : null,
    );
  }
}
