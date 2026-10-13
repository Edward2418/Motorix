import 'package:flutter/material.dart';

/// Texto de una celda de tabla con ancho máximo: si no cabe se recorta con puntos suspensivos
/// y el texto completo queda disponible al pasar el cursor.
class CellText extends StatelessWidget {
  const CellText(this.text, {super.key, this.maxWidth = 200});

  final String text;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: BoxConstraints(maxWidth: maxWidth),
      child: Tooltip(
        message: text,
        child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis),
      ),
    );
  }
}
