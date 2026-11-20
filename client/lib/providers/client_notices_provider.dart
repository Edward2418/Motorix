import 'package:flutter/foundation.dart';

import '../models/client_notice.dart';
import '../services/api_client.dart';

/// Clientes por avisar (Sprint 6): carga la lista de hechos vigentes y registra que se avisó a un cliente. Al
/// registrar, el cliente sale de la lista al instante; si el servidor rechaza (ya avisado o ya no vigente), se vuelve
/// a consultar para mostrar el estado real.
class ClientNoticesProvider extends ChangeNotifier {
  ClientNoticesProvider(this._api);

  final ApiClient _api;

  List<PendingClientNotice> _items = const [];
  bool _loading = false;
  String? _error;

  List<PendingClientNotice> get items => _items;
  bool get loading => _loading;
  String? get error => _error;

  Future<void> load() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final response = await _api.get('/client-notices');
      _items = [
        for (final item in response['data'] as List<dynamic>) PendingClientNotice.fromJson(item as Map<String, dynamic>),
      ];
    } on ApiException catch (e) {
      _error = e.message;
    } catch (_) {
      _error = 'El servidor devolvió una respuesta inesperada.';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Registra el aviso con una nota opcional y quita al cliente de la lista. Devuelve `null` si salió bien o el
  /// mensaje de error en español (tras volver a consultar la lista cuando el hecho ya no aplica).
  Future<String?> register(PendingClientNotice notice, {String? note}) async {
    final trimmed = note?.trim();
    try {
      await _api.post('/client-notices', body: {
        'reason': notice.reason.apiValue,
        'factKey': notice.factKey,
        if (trimmed != null && trimmed.isNotEmpty) 'note': trimmed,
      });
      _items = _items.where((item) => !(item.reason == notice.reason && item.factKey == notice.factKey)).toList();
      notifyListeners();
      return null;
    } on ApiException catch (e) {
      if (e.statusCode == 409) {
        await load();
      }
      return e.message;
    } catch (_) {
      return 'El servidor devolvió una respuesta inesperada.';
    }
  }
}
