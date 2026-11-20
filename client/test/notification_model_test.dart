import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/models/notification.dart';

Map<String, dynamic> avisoJson({
  String key = 'STOCK:3',
  String type = 'STOCK_OUT',
  int severity = 2,
  bool read = false,
  String module = 'inventory',
  int id = 3,
}) =>
    {
      'key': key,
      'type': type,
      'severity': severity,
      'title': 'Bujía de iridio agotada',
      'detail': '0 en existencia (mínimo 3)',
      'read': read,
      'target': {'module': module, 'id': id},
    };

Map<String, dynamic> centroJson() => {
      'unread': 2,
      'groups': [
        {
          'type': 'STOCK_OUT',
          'label': 'Refacciones agotadas',
          'total': 12,
          'unread': 2,
          'items': [avisoJson(), avisoJson(key: 'STOCK:4', id: 4)],
        },
      ],
    };

void main() {
  test('NotificationCenter.fromJson convierte el total, los grupos y los avisos con su destino', () {
    final centro = NotificationCenter.fromJson(centroJson());
    expect(centro.unread, 2);
    expect(centro.isEmpty, isFalse);
    expect(centro.groups, hasLength(1));
    final grupo = centro.groups.single;
    expect(grupo.label, 'Refacciones agotadas');
    expect(grupo.total, 12);
    expect(grupo.unread, 2);
    expect(grupo.hidden, 10);
    final aviso = grupo.items.first;
    expect(aviso.key, 'STOCK:3');
    expect(aviso.severity, 2);
    expect(aviso.isGrave, isTrue);
    expect(aviso.read, isFalse);
    expect(aviso.targetModule, 'inventory');
    expect(aviso.targetId, 3);
  });

  test('un centro sin grupos está vacío', () {
    final centro = NotificationCenter.fromJson({'unread': 0, 'groups': <dynamic>[]});
    expect(centro.isEmpty, isTrue);
    expect(centro.unread, 0);
  });

  test('targetLabel y targetOrderId llevan cada aviso a su sección del menú', () {
    expect(AppNotification.fromJson(avisoJson(module: 'orders', id: 41)).targetLabel, 'Órdenes de servicio');
    expect(AppNotification.fromJson(avisoJson(module: 'orders', id: 41)).targetOrderId, 41);
    expect(AppNotification.fromJson(avisoJson(module: 'appointments')).targetLabel, 'Citas');
    expect(AppNotification.fromJson(avisoJson(module: 'maintenance')).targetLabel, 'Mantenimientos');
    expect(AppNotification.fromJson(avisoJson(module: 'inventory')).targetLabel, 'Inventario');
    expect(AppNotification.fromJson(avisoJson(module: 'inventory')).targetOrderId, isNull);
  });

  test('un aviso de gravedad 1 no es grave', () {
    expect(AppNotification.fromJson(avisoJson(type: 'STOCK_LOW', severity: 1)).isGrave, isFalse);
  });

  test('markedRead marca el aviso como leído y baja el contador del grupo', () {
    final centro = NotificationCenter.fromJson(centroJson()).markedRead('STOCK:3', 1);
    expect(centro.unread, 1);
    final grupo = centro.groups.single;
    expect(grupo.unread, 1);
    expect(grupo.items.firstWhere((a) => a.key == 'STOCK:3').read, isTrue);
    expect(grupo.items.firstWhere((a) => a.key == 'STOCK:4').read, isFalse);
  });

  test('markedRead de un aviso que ya estaba leído no cambia el contador del grupo', () {
    final centro = NotificationCenter.fromJson(centroJson()).markedRead('STOCK:3', 1).markedRead('STOCK:3', 1);
    expect(centro.groups.single.unread, 1);
  });
}
