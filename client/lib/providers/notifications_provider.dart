import 'package:flutter/foundation.dart';

import '../models/notification.dart';
import '../services/api_client.dart';

/// Centro de notificaciones (Sprint 6). El contador se consulta al iniciar sesión y cada vez que se cambia de módulo,
/// y el detalle al abrir el panel; no hay consulta periódica. Si el contador falla, no se interrumpe nada.
class NotificationsProvider extends ChangeNotifier {
  NotificationsProvider(this._api);

  final ApiClient _api;

  int _unread = 0;
  NotificationCenter? _center;
  bool _loading = false;
  String? _error;

  /// Avisos no leídos del usuario (lo que muestra la campana).
  int get unread => _unread;
  NotificationCenter? get center => _center;
  bool get loading => _loading;
  String? get error => _error;

  /// Consulta solo el total de no leídos. Si falla, conserva el valor anterior sin molestar a la persona.
  Future<void> refreshCount() async {
    try {
      final response = await _api.get('/notifications/count');
      final data = response['data'] as Map<String, dynamic>;
      _unread = (data['unread'] as num).toInt();
      notifyListeners();
    } catch (_) {
      // El contador es informativo: un fallo no debe interrumpir el resto de la pantalla.
    }
  }

  /// Consulta el detalle de los avisos al abrir el panel.
  Future<void> loadCenter() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final response = await _api.get('/notifications');
      final center = NotificationCenter.fromJson(response['data'] as Map<String, dynamic>);
      _center = center;
      _unread = center.unread;
    } on ApiException catch (e) {
      _error = e.message;
    } catch (_) {
      _error = 'El servidor devolvió una respuesta inesperada.';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Marca un aviso como leído. El contador baja al instante con el total que informa el servidor.
  Future<void> markRead(String key) async {
    try {
      final response = await _api.post('/notifications/read', body: {'key': key});
      final data = response['data'] as Map<String, dynamic>;
      _unread = (data['unread'] as num).toInt();
      _center = _center?.markedRead(key, _unread);
      notifyListeners();
    } catch (_) {
      // Si no se pudo marcar, el aviso sigue sin leer; la navegación al módulo no se bloquea.
    }
  }

  /// Limpia el estado al iniciar una sesión nueva (sin avisar: se usa antes de dibujar).
  void reset() {
    _unread = 0;
    _center = null;
    _loading = false;
    _error = null;
  }
}
