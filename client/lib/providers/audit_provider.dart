import 'package:flutter/foundation.dart';

import '../models/audit_entry.dart';
import '../models/user.dart';
import '../services/api_client.dart';

/// Consulta de la bitácora (solo administración): registros filtrados por fecha, usuario y acción, paginados.
class AuditProvider extends ChangeNotifier {
  AuditProvider(this._api);

  final ApiClient _api;

  static const int pageSize = 20;

  List<AuditEntry> _items = const [];
  List<User> _users = const [];
  int _total = 0;
  int _page = 1;
  String _from = '';
  String _to = '';
  int? _userId;
  String? _action;
  bool _loading = false;
  String? _error;

  List<AuditEntry> get items => _items;

  /// Usuarios para el filtro por usuario (activos e inactivos).
  List<User> get users => _users;
  int get total => _total;
  int get page => _page;
  String get from => _from;
  String get to => _to;
  int? get userId => _userId;
  String? get action => _action;
  bool get loading => _loading;
  String? get error => _error;
  int get totalPages => _total == 0 ? 1 : (_total / pageSize).ceil();

  Future<void> load() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final response = await _api.get('/audit-log', query: {
        if (_from.isNotEmpty) 'from': _from,
        if (_to.isNotEmpty) 'to': _to,
        'userId': ?_userId?.toString(),
        'action': ?_action,
        'page': '$_page',
        'pageSize': '$pageSize',
      });
      _items = [
        for (final item in response['data'] as List<dynamic>) AuditEntry.fromJson(item as Map<String, dynamic>),
      ];
      _total = (response['meta'] as Map<String, dynamic>)['total'] as int;
    } on ApiException catch (e) {
      _error = e.message;
      _items = const [];
    } catch (_) {
      _error = 'El servidor devolvió una respuesta inesperada.';
      _items = const [];
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Carga los usuarios del filtro. Si falla, el filtro por usuario queda vacío y el resto sigue funcionando.
  Future<void> loadUsers() async {
    try {
      final response = await _api.get('/users', query: {'active': 'all', 'pageSize': '100'});
      _users = [
        for (final item in response['data'] as List<dynamic>) User.fromJson(item as Map<String, dynamic>),
      ];
      notifyListeners();
    } catch (_) {
      // El filtro por usuario simplemente no ofrece opciones.
    }
  }

  /// Aplica los filtros (fechas ya validadas, `AAAA-MM-DD` o vacías) y vuelve a la primera página.
  Future<void> applyFilters({String from = '', String to = '', int? userId, String? action}) {
    _from = from;
    _to = to;
    _userId = userId;
    _action = action;
    _page = 1;
    return load();
  }

  Future<void> clearFilters() => applyFilters();

  Future<void> goToPage(int page) {
    _page = page.clamp(1, totalPages);
    return load();
  }
}
