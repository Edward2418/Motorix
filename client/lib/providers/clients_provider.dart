import 'package:flutter/foundation.dart';

import '../models/client.dart';
import '../services/api_client.dart';

/// Filtro de estado del listado: activos (por defecto), inactivos o todos.
enum ActiveFilter {
  active('true', 'Activos'),
  inactive('false', 'Inactivos'),
  all('all', 'Todos');

  const ActiveFilter(this.apiValue, this.label);

  final String apiValue;
  final String label;
}

class ClientsProvider extends ChangeNotifier {
  ClientsProvider(this._api);

  final ApiClient _api;

  static const int pageSize = 10;

  List<Client> _items = const [];
  int _total = 0;
  int _page = 1;
  String _search = '';
  ActiveFilter _filter = ActiveFilter.active;
  bool _loading = false;
  String? _error;

  List<Client> get items => _items;
  int get total => _total;
  int get page => _page;
  String get search => _search;
  ActiveFilter get filter => _filter;
  bool get loading => _loading;
  String? get error => _error;
  int get totalPages => _total == 0 ? 1 : (_total / pageSize).ceil();

  Future<void> load() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final response = await _api.get('/clients', query: {
        'search': _search,
        'active': _filter.apiValue,
        'page': '$_page',
        'pageSize': '$pageSize',
      });
      _items = [
        for (final item in response['data'] as List<dynamic>) Client.fromJson(item as Map<String, dynamic>),
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

  Future<void> setSearch(String value) {
    _search = value.trim();
    _page = 1;
    return load();
  }

  Future<void> setFilter(ActiveFilter value) {
    _filter = value;
    _page = 1;
    return load();
  }

  Future<void> goToPage(int page) {
    _page = page.clamp(1, totalPages);
    return load();
  }

  Future<Client> fetch(int id) async {
    final response = await _api.get('/clients/$id');
    return Client.fromJson(response['data'] as Map<String, dynamic>);
  }

  /// Edita un cliente. Lanza [ApiException] con los errores por campo si el servidor rechaza los datos.
  Future<Client> update(int id, {required String name, required String phone, String? email}) async {
    final response = await _api.put('/clients/$id', body: {
      'name': name,
      'phone': phone,
      'email': (email == null || email.isEmpty) ? null : email,
    });
    final client = Client.fromJson(response['data'] as Map<String, dynamic>);
    await load();
    return client;
  }

  /// Desactiva o reactiva un cliente (baja lógica). El servidor rechaza la baja si hay vehículos activos.
  Future<Client> setActive(int id, bool active) async {
    final response = await _api.patch('/clients/$id/status', body: {'active': active});
    final client = Client.fromJson(response['data'] as Map<String, dynamic>);
    await load();
    return client;
  }

  /// Registra un cliente. Lanza [ApiException] con los errores por campo si el servidor rechaza los datos.
  Future<Client> create({required String name, required String phone, String? email}) async {
    final response = await _api.post('/clients', body: {
      'name': name,
      'phone': phone,
      'email': (email == null || email.isEmpty) ? null : email,
    });
    final client = Client.fromJson(response['data'] as Map<String, dynamic>);
    await load();
    return client;
  }
}
