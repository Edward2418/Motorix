/// Nivel de stock de una refacción (coincide con la API).
enum StockLevel {
  normal('NORMAL', 'Normal'),
  low('BAJO', 'Bajo'),
  outOfStock('AGOTADO', 'Agotado');

  const StockLevel(this.apiValue, this.label);

  final String apiValue;
  final String label;

  static StockLevel fromApi(String value) =>
      StockLevel.values.firstWhere((l) => l.apiValue == value, orElse: () => StockLevel.normal);

  /// Bajo o agotado: requiere reabastecer.
  bool get needsRestock => this != normal;
}

/// Refacción del catálogo. El mecánico no recibe el precio de compra (queda nulo).
class Part {
  const Part({
    required this.id,
    required this.code,
    required this.name,
    required this.category,
    required this.brand,
    required this.stock,
    required this.minStock,
    required this.stockLevel,
    required this.salePrice,
    required this.active,
    this.purchasePrice,
  });

  final int id;
  final String code;
  final String name;
  final String category;
  final String brand;
  final int stock;
  final int minStock;
  final StockLevel stockLevel;
  final double salePrice;
  final bool active;
  final double? purchasePrice;

  factory Part.fromJson(Map<String, dynamic> json) => Part(
        id: json['id'] as int,
        code: json['code'] as String,
        name: json['name'] as String,
        category: json['category'] as String,
        brand: json['brand'] as String,
        stock: json['stock'] as int,
        minStock: json['minStock'] as int,
        stockLevel: StockLevel.fromApi(json['stockLevel'] as String),
        salePrice: (json['salePrice'] as num).toDouble(),
        active: json['active'] as bool,
        purchasePrice: (json['purchasePrice'] as num?)?.toDouble(),
      );
}
