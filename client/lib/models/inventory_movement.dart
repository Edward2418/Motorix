/// Tipos de movimiento de inventario (coinciden con la API).
enum MovementType {
  entry('ENTRADA', 'Entrada'),
  exit('SALIDA', 'Salida'),
  adjustment('AJUSTE', 'Ajuste');

  const MovementType(this.apiValue, this.label);

  final String apiValue;
  final String label;

  static MovementType fromApi(String value) =>
      MovementType.values.firstWhere((t) => t.apiValue == value, orElse: () => MovementType.adjustment);
}

/// Movimiento inmutable de inventario. `quantity` lleva signo: positivo suma y negativo resta.
class InventoryMovement {
  const InventoryMovement({
    required this.id,
    required this.partId,
    required this.type,
    required this.quantity,
    required this.stockAfter,
    required this.reason,
    required this.createdByName,
    required this.createdAt,
    this.orderId,
    this.orderFolio,
  });

  final int id;
  final int partId;
  final MovementType type;
  final int quantity;
  final int stockAfter;
  final String reason;
  final String createdByName;
  final DateTime createdAt;
  final int? orderId;
  final String? orderFolio;

  factory InventoryMovement.fromJson(Map<String, dynamic> json) => InventoryMovement(
        id: json['id'] as int,
        partId: json['partId'] as int,
        type: MovementType.fromApi(json['type'] as String),
        quantity: json['quantity'] as int,
        stockAfter: json['stockAfter'] as int,
        reason: json['reason'] as String,
        createdByName: (json['createdByName'] ?? '') as String,
        createdAt: DateTime.parse(json['createdAt'] as String).toLocal(),
        orderId: json['orderId'] as int?,
        orderFolio: json['orderFolio'] as String?,
      );
}
