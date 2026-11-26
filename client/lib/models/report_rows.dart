/// Filas de los reportes de operación y de refacciones. Todos los importes y razones los calcula el servidor.
library;

double _number(Object? value) => (value as num).toDouble();

double? _optional(Object? value) => (value as num?)?.toDouble();

/// Un servicio de las órdenes terminadas en el periodo: cuántas veces se hizo y cuánto sumó.
class ServiceFrequencyRow {
  const ServiceFrequencyRow({required this.name, required this.count, required this.total});

  factory ServiceFrequencyRow.fromJson(Map<String, dynamic> json) =>
      ServiceFrequencyRow(name: json['name'] as String, count: json['count'] as int, total: _number(json['total']));

  final String name;
  final int count;
  final double total;
}

/// Órdenes terminadas y mano de obra de un mecánico en el periodo.
class ProductivityRow {
  const ProductivityRow({required this.mechanicName, required this.finishedOrders, required this.laborTotal});

  factory ProductivityRow.fromJson(Map<String, dynamic> json) => ProductivityRow(
        mechanicName: json['mechanicName'] as String,
        finishedOrders: json['finishedOrders'] as int,
        laborTotal: _number(json['laborTotal']),
      );

  final String mechanicName;
  final int finishedOrders;
  final double laborTotal;
}

/// Piezas de una refacción vendidas a un mismo precio. Sin precio de compra no hay costo ni margen.
class PartMarginRow {
  const PartMarginRow({
    required this.code,
    required this.name,
    required this.quantity,
    required this.salePrice,
    required this.salesTotal,
    required this.withoutCost,
    this.purchasePrice,
    this.marginPerUnit,
    this.marginTotal,
  });

  factory PartMarginRow.fromJson(Map<String, dynamic> json) => PartMarginRow(
        code: json['code'] as String,
        name: json['name'] as String,
        quantity: json['quantity'] as int,
        salePrice: _number(json['salePrice']),
        salesTotal: _number(json['salesTotal']),
        withoutCost: json['withoutCost'] as bool,
        purchasePrice: _optional(json['purchasePrice']),
        marginPerUnit: _optional(json['marginPerUnit']),
        marginTotal: _optional(json['marginTotal']),
      );

  final String code;
  final String name;
  final int quantity;
  final double salePrice;
  final double salesTotal;
  final bool withoutCost;
  final double? purchasePrice;
  final double? marginPerUnit;
  final double? marginTotal;
}

/// Totales del margen sobre todo el periodo (no solo la página que se ve).
class PartMarginTotals {
  const PartMarginTotals({required this.salesTotal, required this.costTotal, required this.marginTotal, required this.withoutCostCount});

  factory PartMarginTotals.fromJson(Map<String, dynamic> json) => PartMarginTotals(
        salesTotal: _number(json['salesTotal']),
        costTotal: _number(json['costTotal']),
        marginTotal: _number(json['marginTotal']),
        withoutCostCount: json['withoutCostCount'] as int,
      );

  final double salesTotal;
  final double costTotal;
  final double marginTotal;
  final int withoutCostCount;
}

/// Salidas de una refacción en el periodo frente a su existencia promedio; [turnover] es nulo si el promedio es 0.
class TurnoverRow {
  const TurnoverRow({required this.code, required this.name, required this.unitsOut, required this.averageStock, this.turnover});

  factory TurnoverRow.fromJson(Map<String, dynamic> json) => TurnoverRow(
        code: json['code'] as String,
        name: json['name'] as String,
        unitsOut: json['unitsOut'] as int,
        averageStock: _number(json['averageStock']),
        turnover: _optional(json['turnover']),
      );

  final String code;
  final String name;
  final int unitsOut;
  final double averageStock;
  final double? turnover;
}
