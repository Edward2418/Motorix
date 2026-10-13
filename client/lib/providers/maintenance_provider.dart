import 'package:flutter/foundation.dart';

import '../models/maintenance.dart';
import '../services/api_client.dart';

/// Datos para programar un mantenimiento: al menos una fecha o un kilometraje.
class MaintenanceInput {
  const MaintenanceInput({required this.description, this.dueDate, this.dueMileage, this.notes});

  final String description;
  final DateTime? dueDate;
  final int? dueMileage;
  final String? notes;
}

/// Mantenimientos programados: consulta con estado visual (Normal, Próximo, Vencido), y alta, atención y
/// cancelación desde el detalle de una orden.
class MaintenanceProvider extends ChangeNotifier {
  MaintenanceProvider(this._api);

  final ApiClient _api;

  static const int pageSize = 10;

  List<Maintenance> _items = const [];
  int _total = 0;
  int _page = 1;
  String _search = '';
  MaintenanceVisualStatus? _visualStatus;
  MaintenanceStatus _lifecycle = MaintenanceStatus.scheduled;
  bool _loading = false;
  String? _error;

  List<Maintenance> get items => _items;
  int get total => _total;
  int get page => _page;
  String get search => _search;
  MaintenanceVisualStatus? get visualStatus => _visualStatus;
  MaintenanceStatus get lifecycle => _lifecycle;
  bool get loading => _loading;
  String? get error => _error;
  int get totalPages => _total == 0 ? 1 : (_total / pageSize).ceil();

  Future<void> load() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final response = await _api.get('/maintenance', query: {
        'q': _search,
        'visualStatus': _visualStatus?.apiValue,
        'status': _lifecycle.apiValue,
        'page': '$_page',
        'pageSize': '$pageSize',
      });
      _items = [
        for (final item in response['data'] as List<dynamic>) Maintenance.fromJson(item as Map<String, dynamic>),
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

  Future<void> setVisualStatus(MaintenanceVisualStatus? value) {
    _visualStatus = value;
    _page = 1;
    return load();
  }

  Future<void> setLifecycle(MaintenanceStatus value) {
    _lifecycle = value;
    // El estado visual solo existe para los pendientes.
    if (value != MaintenanceStatus.scheduled) {
      _visualStatus = null;
    }
    _page = 1;
    return load();
  }

  Future<void> goToPage(int page) {
    _page = page.clamp(1, totalPages);
    return load();
  }

  static String _isoDate(DateTime date) {
    final month = date.month.toString().padLeft(2, '0');
    final day = date.day.toString().padLeft(2, '0');
    return '${date.year}-$month-$day';
  }

  /// Programa el próximo mantenimiento desde una orden. Lanza [ApiException] con los errores por campo.
  Future<Maintenance> create(int orderId, MaintenanceInput input) async {
    final response = await _api.post('/orders/$orderId/maintenance', body: {
      'description': input.description,
      if (input.dueDate != null) 'dueDate': _isoDate(input.dueDate!),
      'dueMileage': ?input.dueMileage,
      'notes': ?input.notes,
    });
    notifyListeners();
    return Maintenance.fromJson(response['data'] as Map<String, dynamic>);
  }

  /// Marca el mantenimiento como atendido; [orderId] indica la orden que lo cumplió (opcional).
  Future<Maintenance> fulfill(int id, {int? orderId}) async {
    final response = await _api.post('/maintenance/$id/fulfill', body: {'orderId': ?orderId});
    notifyListeners();
    return Maintenance.fromJson(response['data'] as Map<String, dynamic>);
  }

  Future<Maintenance> cancel(int id, String reason) async {
    final response = await _api.post('/maintenance/$id/cancel', body: {'reason': reason});
    notifyListeners();
    return Maintenance.fromJson(response['data'] as Map<String, dynamic>);
  }
}
