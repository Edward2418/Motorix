import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';

/// Cierra la sesión tras [timeout] sin actividad del puntero ni del teclado. Solo corre mientras hay una sesión abierta.
/// El servidor sigue validando el token en cada petición: esto solo evita dejar la sesión abierta en un equipo
/// desatendido.
class InactivityGuard extends StatefulWidget {
  const InactivityGuard({super.key, required this.child, this.timeout = defaultTimeout});

  static const Duration defaultTimeout = Duration(minutes: 30);

  final Widget child;
  final Duration timeout;

  @override
  State<InactivityGuard> createState() => _InactivityGuardState();
}

class _InactivityGuardState extends State<InactivityGuard> {
  Timer? _timer;
  bool _authenticated = false;

  @override
  void initState() {
    super.initState();
    HardwareKeyboard.instance.addHandler(_onKey);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final authenticated = context.watch<AuthProvider>().isAuthenticated;
    if (authenticated != _authenticated) {
      _authenticated = authenticated;
      authenticated ? _restart() : _stop();
    }
  }

  @override
  void dispose() {
    HardwareKeyboard.instance.removeHandler(_onKey);
    _stop();
    super.dispose();
  }

  bool _onKey(KeyEvent event) {
    _restart();
    return false;
  }

  void _stop() {
    _timer?.cancel();
    _timer = null;
  }

  // Cada actividad reinicia la cuenta; sin sesión no hay nada que contar.
  void _restart() {
    if (!_authenticated) {
      return;
    }
    _timer?.cancel();
    _timer = Timer(widget.timeout, () {
      if (mounted) {
        context.read<AuthProvider>().logoutForInactivity();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) => _restart(),
      onPointerMove: (_) => _restart(),
      onPointerHover: (_) => _restart(),
      onPointerSignal: (_) => _restart(),
      child: widget.child,
    );
  }
}
