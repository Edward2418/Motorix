import 'package:flutter/foundation.dart';

import '../models/user.dart';
import '../services/api_client.dart';

/// Estado de la sesión. El token vive solo en memoria: al cerrar la aplicación hay que iniciar sesión.
class AuthProvider extends ChangeNotifier {
  AuthProvider(this._api) {
    _api.onUnauthorized = _handleExpiredSession;
  }

  final ApiClient _api;

  User? _user;
  bool _loading = false;
  String? _error;
  Map<String, String> _fieldErrors = const {};
  bool _sessionExpired = false;

  User? get user => _user;
  bool get isAuthenticated => _user != null;
  bool get loading => _loading;
  String? get error => _error;
  Map<String, String> get fieldErrors => _fieldErrors;

  /// Indica que la sesión terminó porque el servidor la rechazó (token vencido o cuenta desactivada).
  bool get sessionExpired => _sessionExpired;

  Future<bool> login(String identifier, String password) async {
    _loading = true;
    _error = null;
    _fieldErrors = const {};
    _sessionExpired = false;
    notifyListeners();
    try {
      final response = await _api.post('/auth/login', body: {
        'identifier': identifier.trim(),
        'password': password,
      });
      final data = response['data'] as Map<String, dynamic>;
      _api.setToken(data['token'] as String);
      _user = User.fromJson(data['user'] as Map<String, dynamic>);
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

  void logout() {
    _api.setToken(null);
    _user = null;
    _error = null;
    _sessionExpired = false;
    notifyListeners();
  }

  void _handleExpiredSession() {
    _api.setToken(null);
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
