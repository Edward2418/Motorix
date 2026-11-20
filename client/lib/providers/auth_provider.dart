import 'package:flutter/foundation.dart';

import '../models/user.dart';
import '../services/api_client.dart';

/// Estado de la sesión. El token vive solo en memoria: al cerrar la aplicación hay que iniciar sesión.
class AuthProvider extends ChangeNotifier {
  AuthProvider(this._api) {
    _api.onUnauthorized = _handleExpiredSession;
    _api.onTermsRequired = _handleTermsRequired;
  }

  final ApiClient _api;

  User? _user;
  bool _loading = false;
  String? _error;
  Map<String, String> _fieldErrors = const {};
  bool _sessionExpired = false;
  bool _endedByInactivity = false;
  bool _termsPending = false;

  User? get user => _user;

  /// Hay una versión de los términos y condiciones que la persona aún no acepta: debe verla antes de usar la aplicación.
  bool get termsPending => _termsPending;
  bool get isAuthenticated => _user != null;
  bool get loading => _loading;
  String? get error => _error;
  Map<String, String> get fieldErrors => _fieldErrors;

  /// Indica que la sesión terminó porque el servidor la rechazó (token vencido o cuenta desactivada).
  bool get sessionExpired => _sessionExpired;

  /// Indica que la sesión se cerró porque pasaron 30 minutos sin actividad (motivo `inactivity`).
  bool get endedByInactivity => _endedByInactivity;

  Future<bool> login(String identifier, String password) async {
    _loading = true;
    _error = null;
    _fieldErrors = const {};
    _sessionExpired = false;
    _endedByInactivity = false;
    notifyListeners();
    try {
      final response = await _api.post('/auth/login', body: {
        'identifier': identifier.trim(),
        'password': password,
      });
      final data = response['data'] as Map<String, dynamic>;
      _api.setToken(data['token'] as String);
      _user = User.fromJson(data['user'] as Map<String, dynamic>);
      _termsPending = data['termsAccepted'] == false;
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      _fieldErrors = e.fieldErrors;
      return false;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// La persona aceptó los términos vigentes (o ya no hay ninguna versión publicada): puede entrar a la aplicación.
  void termsAccepted() {
    _termsPending = false;
    notifyListeners();
  }

  // El servidor rechazó una llamada por términos pendientes (por ejemplo, se publicó una versión nueva con la sesión abierta).
  void _handleTermsRequired() {
    if (_user != null && !_termsPending) {
      _termsPending = true;
      notifyListeners();
    }
  }

  void logout() {
    _api.setToken(null);
    _termsPending = false;
    _user = null;
    _error = null;
    _sessionExpired = false;
    _endedByInactivity = false;
    notifyListeners();
  }

  /// Cierra la sesión por inactividad; la pantalla de inicio explica el motivo. Sin sesión no hace nada.
  void logoutForInactivity() {
    if (_user == null) {
      return;
    }
    _api.setToken(null);
    _termsPending = false;
    _user = null;
    _error = null;
    _sessionExpired = false;
    _endedByInactivity = true;
    notifyListeners();
  }

  void _handleExpiredSession() {
    _api.setToken(null);
    _termsPending = false;
    _user = null;
    _sessionExpired = true;
    notifyListeners();
  }

  /// Cambia la contraseña del usuario actual. Lanza [ApiException] con los requisitos que faltan.
  Future<void> changePassword(String currentPassword, String newPassword) async {
    await _api.put('/auth/password', body: {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
    });
  }
}
