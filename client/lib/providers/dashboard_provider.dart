import 'package:flutter/foundation.dart';

import '../models/dashboard.dart';
import '../services/api_client.dart';

/// Periodos del panel (los valores coinciden con el parámetro `period` de la API).
enum DashboardPeriod {
  today('today', 'Hoy'),
  week('week', 'Últimos 7 días'),
  month('month', 'Mes en curso');

  const DashboardPeriod(this.apiValue, this.label);

  final String apiValue;
  final String label;
}

/// Panel de control: consulta los indicadores y las listas de atención del periodo elegido.
class DashboardProvider extends ChangeNotifier {
  DashboardProvider(this._api);

  final ApiClient _api;

  Dashboard? _dashboard;
  DashboardPeriod _period = DashboardPeriod.month;
  bool _loading = false;
  String? _error;

  Dashboard? get dashboard => _dashboard;
  DashboardPeriod get period => _period;
  bool get loading => _loading;
  String? get error => _error;

  Future<void> load() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final response = await _api.get('/dashboard', query: {'period': _period.apiValue});
      _dashboard = Dashboard.fromJson(response['data'] as Map<String, dynamic>);
    } on ApiException catch (e) {
      _error = e.message;
    } catch (_) {
      _error = 'El servidor devolvió una respuesta inesperada.';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Cambia el periodo y vuelve a consultar.
  Future<void> setPeriod(DashboardPeriod value) {
    _period = value;
    return load();
  }
}
