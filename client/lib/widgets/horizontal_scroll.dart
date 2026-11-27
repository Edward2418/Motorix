import 'package:flutter/material.dart';

import '../utils/app_tokens.dart';

/// Desplazamiento horizontal con la barra siempre visible, para que se note que una tabla ancha tiene más columnas.
class HorizontalScroll extends StatefulWidget {
  const HorizontalScroll({super.key, required this.child});

  final Widget child;

  @override
  State<HorizontalScroll> createState() => _HorizontalScrollState();
}

class _HorizontalScrollState extends State<HorizontalScroll> {
  final _controller = ScrollController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scrollbar(
      controller: _controller,
      thumbVisibility: true,
      child: SingleChildScrollView(
        controller: _controller,
        scrollDirection: Axis.horizontal,
        // El espacio de abajo evita que la barra tape la última fila.
        padding: const EdgeInsets.only(bottom: AppSpacing.md),
        child: widget.child,
      ),
    );
  }
}
