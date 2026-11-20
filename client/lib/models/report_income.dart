import 'payment.dart';

/// Ingresos de un rango: suma de los pagos cobrados (PAGADO), por método de pago y por día. Los importes los calcula el
/// servidor en centavos y coinciden con los pagos que los originan.
class IncomeReport {
  const IncomeReport({
    required this.from,
    required this.to,
    required this.total,
    required this.paymentsCount,
    required this.byMethod,
    required this.byDay,
  });

  factory IncomeReport.fromJson(Map<String, dynamic> json) => IncomeReport(
        from: json['from'] as String,
        to: json['to'] as String,
        total: (json['total'] as num).toDouble(),
        paymentsCount: json['paymentsCount'] as int,
        byMethod: [
          for (final item in json['byMethod'] as List<dynamic>) IncomeByMethod.fromJson(item as Map<String, dynamic>),
        ],
        byDay: [
          for (final item in json['byDay'] as List<dynamic>) IncomeByDay.fromJson(item as Map<String, dynamic>),
        ],
      );

  final String from;
  final String to;
  final double total;
  final int paymentsCount;
  final List<IncomeByMethod> byMethod;
  final List<IncomeByDay> byDay;

  /// Sin ningún pago cobrado en el rango.
  bool get isEmpty => paymentsCount == 0;
}

class IncomeByMethod {
  const IncomeByMethod({required this.method, required this.total, required this.count});

  factory IncomeByMethod.fromJson(Map<String, dynamic> json) => IncomeByMethod(
        method: PaymentMethod.fromApi(json['method'] as String),
        total: (json['total'] as num).toDouble(),
        count: json['count'] as int,
      );

  final PaymentMethod method;
  final double total;
  final int count;
}

class IncomeByDay {
  const IncomeByDay({required this.date, required this.total});

  factory IncomeByDay.fromJson(Map<String, dynamic> json) => IncomeByDay(
        date: DateTime.parse(json['date'] as String),
        total: (json['total'] as num).toDouble(),
      );

  final DateTime date;
  final double total;
}
