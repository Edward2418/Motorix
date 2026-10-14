import 'package:flutter/foundation.dart';

/// Sección activa del menú lateral. Permite que otras pantallas (como el panel de control) abran un módulo.
class NavigationProvider extends ChangeNotifier {
  String? _selectedLabel;
  int? _pendingOrderId;

  /// Etiqueta de la sección elegida, o `null` para la primera del menú.
  String? get selectedLabel => _selectedLabel;

  /// Abre la sección con esa etiqueta (por ejemplo «Citas»). Si [orderId] viene, el módulo de órdenes abre su detalle.
  void select(String label, {int? orderId}) {
    _selectedLabel = label;
    _pendingOrderId = orderId;
    notifyListeners();
  }

  /// Vuelve a la primera sección sin avisar (se usa al iniciar sesión, antes de dibujar).
  void reset() {
    _selectedLabel = null;
    _pendingOrderId = null;
  }

  /// Devuelve la orden pendiente de abrir y la consume: solo se entrega una vez.
  int? takePendingOrderId() {
    final id = _pendingOrderId;
    _pendingOrderId = null;
    return id;
  }
}
