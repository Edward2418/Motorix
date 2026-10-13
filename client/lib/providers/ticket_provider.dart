import 'package:flutter/foundation.dart';

import '../models/ticket.dart';
import '../services/api_client.dart';

/// Ticket de la orden abierta en pantalla: consulta y generación (la generación es idempotente en el servidor).
class TicketProvider extends ChangeNotifier {
  TicketProvider(this._api);

  final ApiClient _api;

  Ticket? _ticket;
  bool _loading = false;
  bool _generating = false;
  bool _missing = false;
  String? _error;

  Ticket? get ticket => _ticket;
  bool get loading => _loading;
  bool get generating => _generating;

  /// La orden todavía no tiene ticket (el servidor respondió TICKET_NOT_FOUND).
  bool get missing => _missing;
  String? get error => _error;

  /// Consulta el ticket de la orden. Si todavía no existe, [missing] queda en `true`.
  Future<void> load(int orderId) async {
    _ticket = null;
    _missing = false;
    _error = null;
    _loading = true;
    notifyListeners();
    try {
      final response = await _api.get('/orders/$orderId/ticket');
      _ticket = Ticket.fromJson(response['data'] as Map<String, dynamic>);
    } on ApiException catch (e) {
      if (e.code == 'TICKET_NOT_FOUND') {
        _missing = true;
      } else {
        _error = e.message;
      }
    } catch (_) {
      _error = 'El servidor devolvió una respuesta inesperada.';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Genera el ticket (o recupera el existente con el mismo folio). Lanza [ApiException] si el servidor lo rechaza.
  Future<Ticket> generate(int orderId) async {
    _generating = true;
    _error = null;
    notifyListeners();
    try {
      final response = await _api.post('/orders/$orderId/ticket');
      _ticket = Ticket.fromJson(response['data'] as Map<String, dynamic>);
      _missing = false;
      return _ticket!;
    } finally {
      _generating = false;
      notifyListeners();
    }
  }
}
