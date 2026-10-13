import 'package:flutter/foundation.dart';

import '../models/user.dart';
import '../services/api_client.dart';
import 'clients_provider.dart';

class UsersProvider extends ChangeNotifier {
  UsersProvider(this._api);

  final ApiClient _api;

  static const int pageSize = 10;

  List<User> _items = const [];
  int _total = 0;
  int _page = 1;
  String _search = '';
  ActiveFilter _filter = ActiveFilter.active;
  bool _loading = false;
  String? _error;

  List<User> get items => _items;
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
      final response = await _api.get('/users', query: {
        'search': _search,
        'active': _filter.apiValue,
        'page': '$_page',
        'pageSize': '$pageSize',
      });
      _items = [
        for (final item in response['data'] as List<dynamic>) User.fromJson(item as Map<String, dynamic>),
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

  /// Registra un usuario. Lanza [ApiException] con los errores por campo si el servidor rechaza los datos.
  Future<User> create({
    required String username,
    required String name,
    required String email,
    required String password,
    required UserRole role,
  }) async {
    final response = await _api.post('/users', body: {
      'username': username,
      'name': name,
      'email': email,
      'password': password,
      'role': role.apiValue,
    });
    await load();
    return User.fromJson(response['data'] as Map<String, dynamic>);
  }

  Future<User> update(int id, {required String name, required String email, required UserRole role}) async {
    final response = await _api.put('/users/$id', body: {
      'name': name,
      'email': email,
      'role': role.apiValue,
    });
    await load();
    return User.fromJson(response['data'] as Map<String, dynamic>);
  }

  /// Desactiva o reactiva un usuario (baja lógica).
  Future<User> setActive(int id, bool active) async {
    final response = await _api.patch('/users/$id/status', body: {'active': active});
    await load();
    return User.fromJson(response['data'] as Map<String, dynamic>);
  }
}
