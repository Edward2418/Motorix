import 'package:flutter/foundation.dart';

import '../models/report_income.dart';
import '../services/api_client.dart';

/// Atajos de periodo de los reportes: hoy, los últimos siete días (hoy y los seis anteriores) y el mes en curso.
enum ReportShortcut {
  today('Hoy'),
  week('Semana'),
  month('Mes');

  const ReportShortcut(this.label);

  final String label;
}

/// Fecha como `AAAA-MM-DD`, el formato que usa la API.
String reportDate(DateTime date) =>
    '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

/// Fecha real escrita como `AAAA-MM-DD` o `null` (por ejemplo, 2026-02-30 no lo es).
DateTime? parseReportDate(String text) {
  final match = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(text.trim());
  if (match == null) {
    return null;
  }
  final year = int.parse(match.group(1)!);
  final month = int.parse(match.group(2)!);
  final day = int.parse(match.group(3)!);
  final date = DateTime(year, month, day);
  return date.year == year && date.month == month && date.day == day ? date : null;
}

/// Mensaje de error de un rango escrito a mano, o `null` si es válido (mismas reglas que el servidor).
String? validateReportRange(String from, String to) {
  const dateMessage = 'Escribe la fecha como AAAA-MM-DD, por ejemplo 2026-11-01.';
  final start = parseReportDate(from);
  final end = parseReportDate(to);
  if (start == null || end == null) {
    return dateMessage;
  }
  if (start.isAfter(end)) {
    return 'La fecha inicial no puede ser posterior a la final.';
  }
  // Días naturales, sin que un cambio de horario sume o reste una hora.
  final days = DateTime.utc(end.year, end.month, end.day).difference(DateTime.utc(start.year, start.month, start.day)).inDays + 1;
  return days > 366 ? 'El rango no puede pasar de 366 días.' : null;
}

/// Reportes de administración: el rango que se consulta y el reporte de ingresos de ese rango.
class ReportsProvider extends ChangeNotifier {
  ReportsProvider(this._api, {DateTime Function()? now}) : _now = now ?? DateTime.now {
    _setShortcut(ReportShortcut.month);
  }

  final ApiClient _api;
  final DateTime Function() _now;

  ReportShortcut? _shortcut;
  String _from = '';
  String _to = '';
  IncomeReport? _income;
  bool _loading = false;
  String? _error;

  /// Atajo activo; `null` cuando el rango se escribió a mano.
  ReportShortcut? get shortcut => _shortcut;
  String get from => _from;
  String get to => _to;
  IncomeReport? get income => _income;
  bool get loading => _loading;
  String? get error => _error;

  void _setShortcut(ReportShortcut shortcut) {
    final today = _now();
    _shortcut = shortcut;
    _to = reportDate(today);
    _from = switch (shortcut) {
      ReportShortcut.today => reportDate(today),
      ReportShortcut.week => reportDate(DateTime(today.year, today.month, today.day - 6)),
      ReportShortcut.month => reportDate(DateTime(today.year, today.month, 1)),
    };
  }

  Future<void> loadIncome() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final response = await _api.get('/reports/income', query: {'from': _from, 'to': _to});
      _income = IncomeReport.fromJson(response['data'] as Map<String, dynamic>);
    } on ApiException catch (e) {
      _error = e.message;
      _income = null;
    } catch (_) {
      _error = 'El servidor devolvió una respuesta inesperada.';
      _income = null;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> selectShortcut(ReportShortcut shortcut) {
    _setShortcut(shortcut);
    return loadIncome();
  }

  /// Consulta un rango escrito a mano; las fechas ya deben estar validadas con [validateReportRange].
  Future<void> applyRange(String from, String to) {
    _shortcut = null;
    _from = from.trim();
    _to = to.trim();
    return loadIncome();
  }
}
