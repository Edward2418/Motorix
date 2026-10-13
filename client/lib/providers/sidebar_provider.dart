import 'package:flutter/foundation.dart';

/// Estado del sidebar (expandido o colapsado). Se conserva al navegar entre pantallas.
class SidebarProvider extends ChangeNotifier {
  bool _expanded = true;
  bool _userChoice = false;

  bool get expanded => _expanded;

  void toggle() {
    _expanded = !_expanded;
    _userChoice = true;
    notifyListeners();
  }

  /// Colapsa automáticamente en ventanas angostas mientras el usuario no haya elegido manualmente.
  void adaptToWidth(double width, double threshold) {
    if (_userChoice) {
      return;
    }
    final shouldExpand = width >= threshold;
    if (shouldExpand != _expanded) {
      _expanded = shouldExpand;
      notifyListeners();
    }
  }
}
