import 'package:flutter/foundation.dart';

import '../models/service_type.dart';
import '../services/api_client.dart';

/// Catálogo de tipos de servicio (solo administración lo modifica): listado, alta, edición y activación. Los errores del
/// servidor (nombre repetido, intervalos inválidos) llegan como [ApiException] con el mensaje de cada campo.
class ServiceTypesProvider extends ChangeNotifier {
  ServiceTypesProvider(this._api);

  final ApiClient _api;

  List<ServiceType> _items = const [];
  bool _loading = false;
  String? _error;

  List<ServiceType> get items => _items;
  bool get loading => _loading;
  String? get error => _error;

  Future<void> load() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final response = await _api.get('/service-types');
      _items = [
        for (final item in response['data'] as List<dynamic>) ServiceType.fromJson(item as Map<String, dynamic>),
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

  Map<String, Object?> _body(String name, int? days, int? km) => {
        'name': name,
        'intervalDays': days,
        'intervalKm': km,
      };

  Future<void> create({required String name, int? intervalDays, int? intervalKm}) async {
    await _api.post('/service-types', body: _body(name, intervalDays, intervalKm));
    await load();
  }

  Future<void> update(int id, {required String name, int? intervalDays, int? intervalKm}) async {
    await _api.put('/service-types/$id', body: _body(name, intervalDays, intervalKm));
    await load();
  }

  Future<void> setActive(int id, bool active) async {
    await _api.patch('/service-types/$id/status', body: {'active': active});
    await load();
  }
}
