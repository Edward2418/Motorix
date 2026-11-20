import 'package:flutter/foundation.dart';

import '../models/app_settings.dart';
import '../services/api_client.dart';

/// Configuración del taller (solo administración): carga la configuración vigente y guarda los datos del taller.
/// Los errores de validación del servidor llegan como [ApiException] con el mensaje de cada campo para que el
/// formulario los muestre bajo su campo.
class SettingsProvider extends ChangeNotifier {
  SettingsProvider(this._api);

  final ApiClient _api;

  AppSettings? _settings;
  bool _loading = false;
  String? _error;

  AppSettings? get settings => _settings;
  bool get loading => _loading;
  String? get error => _error;

  Future<void> load() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final response = await _api.get('/settings');
      _settings = AppSettings.fromJson(response['data'] as Map<String, dynamic>);
    } on ApiException catch (e) {
      _error = e.message;
    } catch (_) {
      _error = 'El servidor devolvió una respuesta inesperada.';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Guarda los márgenes de «Próximo» del mantenimiento. Lanza [ApiException] si el servidor rechaza alguno.
  Future<void> saveMaintenance({required int soonDays, required int soonKm}) async {
    final response = await _api.put('/settings', body: {
      'maintenance': {'soonDays': soonDays, 'soonKm': soonKm},
    });
    _settings = AppSettings.fromJson(response['data'] as Map<String, dynamic>);
    notifyListeners();
  }

  /// Guarda los datos del taller. Lanza [ApiException] si el servidor rechaza algún dato (no se guarda ninguno).
  Future<void> saveWorkshop({required String name, required String address, required String phone}) async {
    final response = await _api.put('/settings', body: {
      'workshop': {'name': name, 'address': address, 'phone': phone},
    });
    _settings = AppSettings.fromJson(response['data'] as Map<String, dynamic>);
    notifyListeners();
  }
}
