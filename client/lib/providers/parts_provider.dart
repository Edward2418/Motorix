import 'package:flutter/foundation.dart';

import '../models/inventory_movement.dart';
import '../models/part.dart';
import '../services/api_client.dart';
import 'clients_provider.dart';

/// Catálogo e inventario de refacciones: listado con búsqueda, filtros y paginación, alta, edición,
/// activación, movimientos de inventario y alertas de stock bajo.
class PartsProvider extends ChangeNotifier {
  PartsProvider(this._api);

  final ApiClient _api;

  static const int pageSize = 10;
  static const int movementsPageSize = 10;

  List<Part> _items = const [];
  List<String> _categories = const [];
  List<Part> _alerts = const [];
  int _total = 0;
  int _page = 1;
  String _search = '';
  String _category = '';
  ActiveFilter _activeFilter = ActiveFilter.active;
  StockLevel? _stockLevel;
  bool _lowOnly = false;
  bool _loading = false;
  String? _error;

  List<Part> get items => _items;
  List<String> get categories => _categories;

  /// Refacciones activas con stock bajo o agotado (aviso de reabastecimiento).
  List<Part> get alerts => _alerts;
  int get total => _total;
  int get page => _page;
  String get search => _search;
  String get category => _category;
  ActiveFilter get activeFilter => _activeFilter;
  StockLevel? get stockLevel => _stockLevel;
  bool get lowOnly => _lowOnly;
  bool get loading => _loading;
  String? get error => _error;
  int get totalPages => _total == 0 ? 1 : (_total / pageSize).ceil();

  Future<void> load() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final response = await _api.get('/parts', query: {
        'q': _search,
        'category': _category,
        // «Todos» no envía el filtro: la API devuelve activas e inactivas.
        'active': _activeFilter == ActiveFilter.all ? null : _activeFilter.apiValue,
        'stockLevel': _stockLevel?.apiValue,
        'lowStock': _lowOnly ? 'true' : null,
        'page': '$_page',
        'pageSize': '$pageSize',
      });
      _items = [
        for (final item in response['data'] as List<dynamic>) Part.fromJson(item as Map<String, dynamic>),
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
    // El aviso se actualiza con cada recarga: cualquier movimiento puede cambiar las alertas.
    await refreshAlerts();
  }

  /// Actualiza las alertas. Si falla, el aviso simplemente no se muestra, sin interrumpir la pantalla.
  Future<void> refreshAlerts() async {
    try {
      _alerts = await loadAlerts();
    } catch (_) {
      _alerts = const [];
    }
    notifyListeners();
  }

  /// Categorías existentes, para el filtro. Si falla, el filtro queda vacío sin interrumpir la pantalla.
  Future<void> loadCategories() async {
    try {
      final response = await _api.get('/parts/categories');
      _categories = [for (final name in response['data'] as List<dynamic>) name as String];
      notifyListeners();
    } catch (_) {
      _categories = const [];
    }
  }

  Future<void> setSearch(String value) {
    _search = value.trim();
    _page = 1;
    return load();
  }

  Future<void> setCategory(String value) {
    _category = value;
    _page = 1;
    return load();
  }

  Future<void> setActiveFilter(ActiveFilter value) {
    _activeFilter = value;
    _page = 1;
    return load();
  }

  Future<void> setStockLevel(StockLevel? value) {
    _stockLevel = value;
    _lowOnly = false;
    _page = 1;
    return load();
  }

  /// Muestra solo las refacciones activas con stock bajo o agotado (filtro «Stock bajo»).
  Future<void> setLowOnly(bool value) {
    _lowOnly = value;
    if (value) {
      _stockLevel = null;
      _activeFilter = ActiveFilter.active;
    }
    _page = 1;
    return load();
  }

  Future<void> goToPage(int page) {
    _page = page.clamp(1, totalPages);
    return load();
  }

  Future<Part> fetch(int id) async {
    final response = await _api.get('/parts/$id');
    return Part.fromJson(response['data'] as Map<String, dynamic>);
  }

  /// Registra una refacción. Lanza [ApiException] con los errores por campo si el servidor rechaza los datos.
  Future<Part> create({
    required String code,
    required String name,
    required String category,
    required String brand,
    required int initialStock,
    required int minStock,
    required double purchasePrice,
    required double salePrice,
  }) async {
    final response = await _api.post('/parts', body: {
      'code': code,
      'name': name,
      'category': category,
      'brand': brand,
      'initialStock': initialStock,
      'minStock': minStock,
      'purchasePrice': purchasePrice,
      'salePrice': salePrice,
    });
    await Future.wait([load(), loadCategories()]);
    return Part.fromJson(response['data'] as Map<String, dynamic>);
  }

  /// Edita datos descriptivos, precios y mínimo. El stock solo cambia con movimientos.
  Future<Part> update(
    int id, {
    required String code,
    required String name,
    required String category,
    required String brand,
    required int minStock,
    required double purchasePrice,
    required double salePrice,
  }) async {
    final response = await _api.put('/parts/$id', body: {
      'code': code,
      'name': name,
      'category': category,
      'brand': brand,
      'minStock': minStock,
      'purchasePrice': purchasePrice,
      'salePrice': salePrice,
    });
    await Future.wait([load(), loadCategories()]);
    return Part.fromJson(response['data'] as Map<String, dynamic>);
  }

  /// Desactiva o reactiva una refacción (nunca se elimina).
  Future<Part> setActive(int id, bool active) async {
    final response = await _api.patch('/parts/$id/status', body: {'active': active});
    await load();
    return Part.fromJson(response['data'] as Map<String, dynamic>);
  }

  /// Refacciones activas que coinciden con [text], para elegirlas al trabajar una orden.
  Future<List<Part>> searchActive(String text) async {
    final response = await _api.get('/parts', query: {'q': text.trim(), 'active': 'true', 'pageSize': '20'});
    return [
      for (final item in response['data'] as List<dynamic>) Part.fromJson(item as Map<String, dynamic>),
    ];
  }

  /// Una página de los movimientos de la refacción, del más reciente al más antiguo.
  Future<({List<InventoryMovement> items, int total})> loadMovements(int partId, {int page = 1}) async {
    final response = await _api.get('/parts/$partId/movements', query: {
      'page': '$page',
      'pageSize': '$movementsPageSize',
    });
    return (
      items: [
        for (final item in response['data'] as List<dynamic>)
          InventoryMovement.fromJson(item as Map<String, dynamic>),
      ],
      total: (response['meta'] as Map<String, dynamic>)['total'] as int,
    );
  }

  /// Registra una ENTRADA (reabastecimiento). Recarga el listado para reflejar el nuevo stock.
  Future<InventoryMovement> registerEntry(int partId, {required int quantity, required String reason}) async {
    final response = await _api.post('/parts/$partId/movements', body: {
      'type': MovementType.entry.apiValue,
      'quantity': quantity,
      'reason': reason,
    });
    await load();
    return InventoryMovement.fromJson(response['data'] as Map<String, dynamic>);
  }

  /// Registra un AJUSTE por conteo físico: fija el stock en [countedStock].
  Future<InventoryMovement> registerAdjustment(int partId, {required int countedStock, required String reason}) async {
    final response = await _api.post('/parts/$partId/movements', body: {
      'type': MovementType.adjustment.apiValue,
      'countedStock': countedStock,
      'reason': reason,
    });
    await load();
    return InventoryMovement.fromJson(response['data'] as Map<String, dynamic>);
  }

  /// Refacciones activas con stock bajo o agotado (aviso de reabastecimiento, solo administración).
  Future<List<Part>> loadAlerts() async {
    final response = await _api.get('/parts/alerts');
    return [
      for (final item in response['data'] as List<dynamic>) Part.fromJson(item as Map<String, dynamic>),
    ];
  }
}
