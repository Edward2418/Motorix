import 'package:flutter/foundation.dart';

import '../models/terms.dart';
import '../services/api_client.dart';

/// Términos y condiciones: la versión vigente (para leerla y aceptarla) y, para administración, quién la aceptó.
class TermsProvider extends ChangeNotifier {
  TermsProvider(this._api);

  final ApiClient _api;

  static const int acceptancesPageSize = 10;

  TermsInfo? _current;
  bool _loading = false;
  bool _saving = false;
  String? _error;
  String? _acceptError;

  List<TermsAcceptanceRow> _acceptances = const [];
  int _acceptancesTotal = 0;
  int _acceptancesPage = 1;
  bool _acceptancesLoading = false;
  String? _acceptancesError;

  /// Versión vigente; `null` si no hay ninguna publicada (o aún no se ha cargado).
  TermsInfo? get current => _current;
  bool get loading => _loading;
  bool get saving => _saving;
  String? get error => _error;

  /// Mensaje del último intento de aceptar que falló (por ejemplo, se publicó una versión más nueva).
  String? get acceptError => _acceptError;

  List<TermsAcceptanceRow> get acceptances => _acceptances;
  int get acceptancesTotal => _acceptancesTotal;
  int get acceptancesPage => _acceptancesPage;
  bool get acceptancesLoading => _acceptancesLoading;
  String? get acceptancesError => _acceptancesError;
  int get acceptancesTotalPages => _acceptancesTotal == 0 ? 1 : (_acceptancesTotal / acceptancesPageSize).ceil();

  /// Carga la versión vigente. Termina con `current == null` y sin error si no hay ninguna publicada. Con [public] la
  /// pide sin sesión (pantalla de inicio).
  Future<void> load({bool public = false}) async {
    _loading = true;
    _error = null;
    _acceptError = null;
    notifyListeners();
    try {
      final response = await _api.get(public ? '/terms/public' : '/terms/current');
      final data = response['data'];
      _current = data is Map<String, dynamic> ? TermsInfo.fromJson(data) : null;
    } on ApiException catch (e) {
      _error = e.message;
    } catch (_) {
      _error = 'El servidor devolvió una respuesta inesperada.';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Acepta la versión que se está mostrando. Devuelve `true` si quedó aceptada. Si el servidor dice que ya no es la
  /// vigente, vuelve a cargar la nueva para que la persona la lea, y devuelve `false` con el mensaje en [acceptError].
  Future<bool> accept() async {
    final version = _current?.version;
    if (version == null) {
      return false;
    }
    _saving = true;
    _acceptError = null;
    notifyListeners();
    try {
      await _api.post('/terms/accept', body: {'version': version});
      return true;
    } on ApiException catch (e) {
      final message = e.message;
      if (e.code == 'TERMS_VERSION_OUTDATED') {
        _saving = false;
        await load();
      }
      _acceptError = message;
      return false;
    } catch (_) {
      _acceptError = 'El servidor devolvió una respuesta inesperada.';
      return false;
    } finally {
      _saving = false;
      notifyListeners();
    }
  }

  /// Carga una página de aceptaciones (solo administración).
  Future<void> loadAcceptances({int page = 1}) async {
    _acceptancesPage = page;
    _acceptancesLoading = true;
    _acceptancesError = null;
    notifyListeners();
    try {
      final response = await _api.get('/terms/acceptances', query: {'page': '$page', 'pageSize': '$acceptancesPageSize'});
      _acceptances = [
        for (final item in response['data'] as List<dynamic>) TermsAcceptanceRow.fromJson(item as Map<String, dynamic>),
      ];
      _acceptancesTotal = (response['meta'] as Map<String, dynamic>)['total'] as int;
    } on ApiException catch (e) {
      _acceptancesError = e.message;
      _acceptances = const [];
    } catch (_) {
      _acceptancesError = 'El servidor devolvió una respuesta inesperada.';
      _acceptances = const [];
    } finally {
      _acceptancesLoading = false;
      notifyListeners();
    }
  }

  Future<void> goToAcceptancesPage(int page) => loadAcceptances(page: page.clamp(1, acceptancesTotalPages));
}
