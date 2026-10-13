import 'package:flutter/foundation.dart';

import '../models/client.dart';
import '../models/service_order.dart';
import '../models/vehicle.dart';
import '../services/api_client.dart';

/// Mecánico activo disponible para asignar órdenes.
class MechanicOption {
  const MechanicOption({required this.id, required this.name, required this.openOrders});

  final int id;
  final String name;
  final int openOrders;

  factory MechanicOption.fromJson(Map<String, dynamic> json) => MechanicOption(
        id: json['id'] as int,
        name: json['name'] as String,
        openOrders: (json['openOrders'] ?? 0) as int,
      );
}

/// Tipo de línea de una orden: servicios realizados o mano de obra.
enum LineKind {
  services('services', 'servicio'),
  labor('labor', 'concepto de mano de obra');

  const LineKind(this.path, this.label);

  final String path;
  final String label;
}

class OrdersProvider extends ChangeNotifier {
  OrdersProvider(this._api);

  final ApiClient _api;

  static const int pageSize = 10;

  List<ServiceOrder> _items = const [];
  int _total = 0;
  int _page = 1;
  String _search = '';
  OrderStatus? _statusFilter;
  bool _loading = false;
  String? _error;

  List<ServiceOrder> get items => _items;
  int get total => _total;
  int get page => _page;
  String get search => _search;
  OrderStatus? get statusFilter => _statusFilter;
  bool get loading => _loading;
  String? get error => _error;
  int get totalPages => _total == 0 ? 1 : (_total / pageSize).ceil();

  /// Carga la página actual del listado. El servidor limita a un mecánico a sus órdenes asignadas.
  Future<void> load() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final response = await _api.get('/orders', query: {
        'search': _search,
        'status': _statusFilter?.apiValue,
        'page': '$_page',
        'pageSize': '$pageSize',
      });
      _items = [
        for (final item in response['data'] as List<dynamic>) ServiceOrder.fromJson(item as Map<String, dynamic>),
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

  Future<void> setStatusFilter(OrderStatus? value) {
    _statusFilter = value;
    _page = 1;
    return load();
  }

  Future<void> goToPage(int page) {
    _page = page.clamp(1, totalPages);
    return load();
  }

  /// Mecánicos activos, con su cantidad de órdenes abiertas (solo ADMIN y RECEPTIONIST).
  Future<List<MechanicOption>> fetchMechanics() async {
    final response = await _api.get('/mechanics');
    return [
      for (final item in response['data'] as List<dynamic>) MechanicOption.fromJson(item as Map<String, dynamic>),
    ];
  }

  /// Clientes activos que coinciden con [text], para elegir a quién pertenece la orden.
  Future<List<Client>> searchClients(String text) async {
    final response = await _api.get('/clients', query: {'search': text.trim(), 'active': 'true', 'pageSize': '20'});
    return [
      for (final item in response['data'] as List<dynamic>) Client.fromJson(item as Map<String, dynamic>),
    ];
  }

  /// Vehículos activos de un cliente.
  Future<List<Vehicle>> vehiclesOf(int clientId) async {
    final response = await _api.get('/vehicles', query: {
      'clientId': '$clientId',
      'active': 'true',
      'pageSize': '100',
    });
    return [
      for (final item in response['data'] as List<dynamic>) Vehicle.fromJson(item as Map<String, dynamic>),
    ];
  }

  Future<ServiceOrder> fetchOrder(int id) async {
    final response = await _api.get('/orders/$id');
    return ServiceOrder.fromJson(response['data'] as Map<String, dynamic>);
  }

  /// Crea una orden. Lanza [ApiException] con los errores por campo si el servidor rechaza los datos.
  Future<ServiceOrder> createOrder({
    required int clientId,
    required int vehicleId,
    required int mechanicId,
    required int entryMileage,
    required String reportedProblem,
    int? appointmentId,
    bool correctMileage = false,
    String? mileageCorrectionReason,
  }) async {
    final response = await _api.post('/orders', body: {
      'clientId': clientId,
      'vehicleId': vehicleId,
      'mechanicId': mechanicId,
      'entryMileage': entryMileage,
      'reportedProblem': reportedProblem,
      'appointmentId': ?appointmentId,
      if (correctMileage) 'correctMileage': true,
      if (correctMileage) 'mileageCorrectionReason': mileageCorrectionReason,
    });
    final order = ServiceOrder.fromJson(response['data'] as Map<String, dynamic>);
    notifyListeners();
    return order;
  }

  Future<ServiceOrder> reassignMechanic(int orderId, int mechanicId) async {
    final response = await _api.put('/orders/$orderId/mechanic', body: {'mechanicId': mechanicId});
    final order = ServiceOrder.fromJson(response['data'] as Map<String, dynamic>);
    notifyListeners();
    return order;
  }

  /// Cambia el estado de la orden. La cancelación exige [reason]. El servidor valida la transición y el rol.
  Future<ServiceOrder> changeStatus(int orderId, OrderStatus status, {String? reason}) async {
    final response = await _api.post('/orders/$orderId/status', body: {
      'status': status.apiValue,
      'reason': ?reason,
    });
    final order = ServiceOrder.fromJson(response['data'] as Map<String, dynamic>);
    notifyListeners();
    return order;
  }

  /// Edita el contenido de la orden. Solo se envían los campos indicados; un texto vacío se guarda como nulo.
  Future<ServiceOrder> updateContent(int orderId, Map<String, String?> fields) async {
    final response = await _api.patch('/orders/$orderId', body: fields);
    final order = ServiceOrder.fromJson(response['data'] as Map<String, dynamic>);
    notifyListeners();
    return order;
  }

  /// Agrega un servicio o una línea de mano de obra y devuelve la orden con el total recalculado.
  Future<ServiceOrder> addLine(LineKind kind, int orderId, {required String description, required double amount}) async {
    final response = await _api.post('/orders/$orderId/${kind.path}', body: {'description': description, 'amount': amount});
    final order = ServiceOrder.fromJson(response['data'] as Map<String, dynamic>);
    notifyListeners();
    return order;
  }

  Future<ServiceOrder> updateLine(LineKind kind, int orderId, int lineId,
      {required String description, required double amount}) async {
    final response = await _api.put(
      '/orders/$orderId/${kind.path}/$lineId',
      body: {'description': description, 'amount': amount},
    );
    final order = ServiceOrder.fromJson(response['data'] as Map<String, dynamic>);
    notifyListeners();
    return order;
  }

  /// Quita la línea; la orden nunca se elimina.
  Future<ServiceOrder> removeLine(LineKind kind, int orderId, int lineId) async {
    final response = await _api.delete('/orders/$orderId/${kind.path}/$lineId');
    final order = ServiceOrder.fromJson(response['data'] as Map<String, dynamic>);
    notifyListeners();
    return order;
  }
}
