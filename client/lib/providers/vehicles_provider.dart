import 'package:flutter/foundation.dart';

import '../models/client.dart';
import '../models/history_entry.dart';
import '../models/vehicle.dart';
import '../services/api_client.dart';
import 'clients_provider.dart';

class VehiclesProvider extends ChangeNotifier {
  VehiclesProvider(this._api);

  final ApiClient _api;

  static const int pageSize = 10;
  static const int historyPageSize = 5;

  List<Vehicle> _items = const [];
  int _total = 0;
  int _page = 1;
  String _search = '';
  ActiveFilter _filter = ActiveFilter.active;
  bool _loading = false;
  String? _error;

  List<Vehicle> get items => _items;
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
      final response = await _api.get('/vehicles', query: {
        'search': _search,
        'active': _filter.apiValue,
        'page': '$_page',
        'pageSize': '$pageSize',
      });
      _items = [
        for (final item in response['data'] as List<dynamic>) Vehicle.fromJson(item as Map<String, dynamic>),
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

  /// Clientes activos que coinciden con [text], para elegir al propietario en el formulario.
  Future<List<Client>> searchOwners(String text) async {
    final response = await _api.get('/clients', query: {'search': text.trim(), 'active': 'true', 'pageSize': '20'});
    return [
      for (final item in response['data'] as List<dynamic>) Client.fromJson(item as Map<String, dynamic>),
    ];
  }

  /// Registra un vehículo. Lanza [ApiException] con los errores por campo si el servidor rechaza los datos.
  Future<Vehicle> create({
    required int clientId,
    required String brand,
    required String model,
    required int year,
    required String licensePlate,
    String? vin,
    int? currentMileage,
  }) async {
    final response = await _api.post('/vehicles', body: {
      'clientId': clientId,
      'brand': brand,
      'model': model,
      'year': year,
      'licensePlate': licensePlate,
      'vin': (vin == null || vin.isEmpty) ? null : vin,
      'currentMileage': ?currentMileage,
    });
    await load();
    return Vehicle.fromJson(response['data'] as Map<String, dynamic>);
  }

  /// Una página del historial de servicios del vehículo (órdenes terminadas y entregadas, la más reciente primero).
  Future<HistoryPage> loadHistory(int vehicleId, {int page = 1, int pageSize = historyPageSize}) async {
    final response = await _api.get('/vehicles/$vehicleId/history', query: {'page': '$page', 'pageSize': '$pageSize'});
    return HistoryPage(
      entries: [
        for (final item in response['data'] as List<dynamic>) HistoryEntry.fromJson(item as Map<String, dynamic>),
      ],
      total: (response['meta'] as Map<String, dynamic>)['total'] as int,
    );
  }

  /// Desactiva o reactiva un vehículo (baja lógica).
  Future<Vehicle> setActive(int id, bool active) async {
    final response = await _api.patch('/vehicles/$id/status', body: {'active': active});
    await load();
    return Vehicle.fromJson(response['data'] as Map<String, dynamic>);
  }
}
