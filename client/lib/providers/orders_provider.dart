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

class OrdersProvider extends ChangeNotifier {
  OrdersProvider(this._api);

  final ApiClient _api;

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
}
