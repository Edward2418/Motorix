import 'package:flutter/material.dart';

/// Envuelve una tabla para que ocupe todo el ancho disponible y se pueda desplazar en ambos sentidos
/// cuando la ventana es angosta (sin recortar la columna de acciones).
class TableScroll extends StatelessWidget {
  const TableScroll({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) => Scrollbar(
        child: SingleChildScrollView(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: ConstrainedBox(
              constraints: BoxConstraints(minWidth: constraints.maxWidth),
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}
