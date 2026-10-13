import 'package:flutter/foundation.dart';

import '../models/appointment.dart';
import '../models/client.dart';
import '../services/api_client.dart';

String _dateOnly(DateTime date) =>
    '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

class AppointmentsProvider extends ChangeNotifier {
  AppointmentsProvider(this._api);

  final ApiClient _api;

  static const int pageSize = 10;

  List<Appointment> _items = const [];
  int _total = 0;
  int _page = 1;
  DateTime? _from;
  DateTime? _to;
  AppointmentStatus? _status;
  Client? _client;
  bool _loading = false;
  String? _error;

  List<Appointment> get items => _items;
  int get total => _total;
  int get page => _page;
  DateTime? get from => _from;
  DateTime? get to => _to;
  AppointmentStatus? get status => _status;
  Client? get client => _client;
  bool get loading => _loading;
  String? get error => _error;
  int get totalPages => _total == 0 ? 1 : (_total / pageSize).ceil();
  bool get hasFilters => _from != null || _to != null || _status != null || _client != null;

  Future<void> load() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final response = await _api.get('/appointments', query: {
        'from': _from == null ? null : _dateOnly(_from!),
        'to': _to == null ? null : _dateOnly(_to!),
        'status': _status?.apiValue,
        'clientId': _client == null ? null : '${_client!.id}',
        'page': '$_page',
        'pageSize': '$pageSize',
      });
      _items = [
        for (final item in response['data'] as List<dynamic>) Appointment.fromJson(item as Map<String, dynamic>),
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

  Future<void> setDateRange(DateTime? from, DateTime? to) {
    _from = from;
    _to = to;
    _page = 1;
    return load();
  }

  Future<void> setStatus(AppointmentStatus? status) {
    _status = status;
    _page = 1;
    return load();
  }

  Future<void> setClient(Client? client) {
    _client = client;
    _page = 1;
    return load();
  }

  Future<void> clearFilters() {
    _from = null;
    _to = null;
    _status = null;
    _client = null;
    _page = 1;
    return load();
  }

  Future<void> goToPage(int page) {
    _page = page.clamp(1, totalPages);
    return load();
  }

  Future<Appointment> fetch(int id) async {
    final response = await _api.get('/appointments/$id');
    return Appointment.fromJson(response['data'] as Map<String, dynamic>);
  }

  /// Registra una cita. Lanza [ApiException] con los errores por campo si el servidor rechaza los datos.
  Future<Appointment> create({
    required int clientId,
    required int vehicleId,
    required DateTime scheduledAt,
    required String reason,
    String? notes,
  }) async {
    final response = await _api.post('/appointments', body: {
      'clientId': clientId,
      'vehicleId': vehicleId,
      'scheduledAt': scheduledAt.toUtc().toIso8601String(),
      'reason': reason,
      'notes': (notes == null || notes.isEmpty) ? null : notes,
    });
    final appointment = Appointment.fromJson(response['data'] as Map<String, dynamic>);
    await load();
    return appointment;
  }

  Future<Appointment> update(
    int id, {
    required DateTime scheduledAt,
    required String reason,
    String? notes,
  }) async {
    final response = await _api.put('/appointments/$id', body: {
      'scheduledAt': scheduledAt.toUtc().toIso8601String(),
      'reason': reason,
      'notes': (notes == null || notes.isEmpty) ? null : notes,
    });
    final appointment = Appointment.fromJson(response['data'] as Map<String, dynamic>);
    await load();
    return appointment;
  }

  Future<Appointment> confirm(int id) async {
    final response = await _api.post('/appointments/$id/confirm');
    final appointment = Appointment.fromJson(response['data'] as Map<String, dynamic>);
    await load();
    return appointment;
  }

  Future<Appointment> cancel(int id, {String? reason}) async {
    final response = await _api.post('/appointments/$id/cancel', body: {
      'reason': (reason == null || reason.isEmpty) ? null : reason,
    });
    final appointment = Appointment.fromJson(response['data'] as Map<String, dynamic>);
    await load();
    return appointment;
  }
}
