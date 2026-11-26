import 'package:flutter/foundation.dart';

import '../models/report_income.dart';
import '../models/report_rows.dart';
import '../services/api_client.dart';
import '../services/report_saver.dart';

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

/// Los reportes disponibles: su título, la ruta de la API y el nombre base del archivo exportado.
enum ReportKind {
  income('Ingresos', '/reports/income', 'ingresos'),
  services('Servicios', '/reports/services', 'servicios', paginated: true),
  productivity('Productividad', '/reports/productivity', 'productividad'),
  partsMargin('Margen de refacciones', '/reports/parts-margin', 'margen-refacciones', paginated: true),
  turnover('Rotación', '/reports/inventory-turnover', 'rotacion', paginated: true);

  const ReportKind(this.title, this.path, this.fileName, {this.paginated = false});

  final String title;
  final String path;
  final String fileName;
  final bool paginated;
}

/// Margen de refacciones: las filas de la página y los totales de todo el periodo.
typedef PartsMargin = ({List<PartMarginRow> items, PartMarginTotals totals});

/// Estado de un reporte para el rango vigente.
class ReportState {
  /// [IncomeReport], [PartsMargin] o la lista de filas del reporte; `null` mientras no haya datos.
  Object? data;
  bool loading = false;
  String? error;
  int page = 1;
  int pageSize = 50;
  int total = 0;

  // Número de la última consulta: una respuesta atrasada de un rango anterior se descarta.
  int _request = 0;
}

/// Reportes de administración: el rango que se consulta y el estado de cada reporte para ese rango. Solo se consulta el
/// reporte que se está viendo; los demás se piden al abrir su pestaña.
class ReportsProvider extends ChangeNotifier {
  ReportsProvider(this._api, {DateTime Function()? now}) : _now = now ?? DateTime.now {
    _setShortcut(ReportShortcut.month);
  }

  final ApiClient _api;
  final DateTime Function() _now;
  final Map<ReportKind, ReportState> _states = {for (final kind in ReportKind.values) kind: ReportState()};

  ReportShortcut? _shortcut;
  String _from = '';
  String _to = '';
  ReportKind _active = ReportKind.income;

  /// Atajo activo; `null` cuando el rango se escribió a mano.
  ReportShortcut? get shortcut => _shortcut;
  String get from => _from;
  String get to => _to;

  /// El reporte que se está viendo: es el que se consulta y se exporta.
  ReportKind get active => _active;

  ReportState stateOf(ReportKind kind) => _states[kind]!;

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

  // Descarta lo consultado: los datos de un rango no sirven para otro.
  void _reset() {
    for (final state in _states.values) {
      state
        ..data = null
        ..loading = false
        ..error = null
        ..page = 1
        ..total = 0
        .._request += 1;
    }
  }

  /// Abre la pantalla de reportes en [kind] con datos recién consultados.
  Future<void> open(ReportKind kind) {
    _active = kind;
    _reset();
    return load(kind);
  }

  /// Cambia de pestaña; solo consulta si ese reporte aún no se pidió para el rango vigente.
  Future<void> show(ReportKind kind) async {
    if (kind == _active) {
      return;
    }
    _active = kind;
    final state = stateOf(kind);
    if (state.data == null && !state.loading && state.error == null) {
      await load(kind);
    } else {
      notifyListeners();
    }
  }

  Future<void> load(ReportKind kind) async {
    final state = stateOf(kind);
    final request = ++state._request;
    state
      ..loading = true
      ..error = null;
    notifyListeners();
    try {
      final response = await _api.get(kind.path, query: {
        'from': _from,
        'to': _to,
        if (kind.paginated) 'page': '${state.page}',
      });
      if (request != state._request) {
        return;
      }
      state.data = _parse(kind, response['data']);
      final meta = response['meta'] as Map<String, dynamic>?;
      if (meta != null) {
        state
          ..pageSize = meta['pageSize'] as int
          ..total = meta['total'] as int;
      }
    } on ApiException catch (e) {
      if (request != state._request) {
        return;
      }
      state
        ..error = e.message
        ..data = null;
    } catch (_) {
      if (request != state._request) {
        return;
      }
      state
        ..error = 'El servidor devolvió una respuesta inesperada.'
        ..data = null;
    }
    state.loading = false;
    notifyListeners();
  }

  Object _parse(ReportKind kind, dynamic data) {
    List<T> rows<T>(dynamic list, T Function(Map<String, dynamic>) fromJson) =>
        [for (final item in list as List<dynamic>) fromJson(item as Map<String, dynamic>)];
    switch (kind) {
      case ReportKind.income:
        return IncomeReport.fromJson(data as Map<String, dynamic>);
      case ReportKind.services:
        return rows(data, ServiceFrequencyRow.fromJson);
      case ReportKind.productivity:
        return rows(data, ProductivityRow.fromJson);
      case ReportKind.partsMargin:
        final json = data as Map<String, dynamic>;
        return (
          items: rows(json['items'], PartMarginRow.fromJson),
          totals: PartMarginTotals.fromJson(json['totals'] as Map<String, dynamic>),
        );
      case ReportKind.turnover:
        return rows(data, TurnoverRow.fromJson);
    }
  }

  Future<void> goToPage(ReportKind kind, int page) {
    stateOf(kind).page = page;
    return load(kind);
  }

  bool _exporting = false;

  /// Hay una exportación en curso (el botón se deshabilita para no exportar dos veces).
  bool get exporting => _exporting;

  /// Exporta a CSV el reporte que se está viendo, con su rango completo, y lo guarda con [saver]. Devuelve la ruta del
  /// archivo. Lanza [ApiException] si el servidor lo rechaza o [ReportSaveException] si no se puede escribir.
  Future<String> exportActive(ReportSaver saver) async {
    if (_exporting) {
      throw StateError('Ya hay una exportación en curso.');
    }
    final kind = _active;
    final from = _from;
    final to = _to;
    _exporting = true;
    notifyListeners();
    try {
      final bytes = await _api.download(kind.path, query: {'from': from, 'to': to, 'format': 'csv'});
      return await saver.save(fileName: '${kind.fileName}-$from-a-$to.csv', bytes: bytes);
    } finally {
      _exporting = false;
      notifyListeners();
    }
  }

  Future<void> selectShortcut(ReportShortcut shortcut) {
    _setShortcut(shortcut);
    _reset();
    return load(_active);
  }

  /// Consulta un rango escrito a mano; las fechas ya deben estar validadas con [validateReportRange].
  Future<void> applyRange(String from, String to) {
    _shortcut = null;
    _from = from.trim();
    _to = to.trim();
    _reset();
    return load(_active);
  }
}
