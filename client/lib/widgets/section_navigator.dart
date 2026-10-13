import 'package:flutter/material.dart';

import '../utils/app_tokens.dart';

/// Navegador propio de cada sección del menú: las pantallas secundarias (detalle, formularios)
/// se muestran dentro del área de contenido sin ocultar el sidebar.
class SectionNavigator extends StatelessWidget {
  const SectionNavigator({super.key, required this.root});

  final WidgetBuilder root;

  @override
  Widget build(BuildContext context) {
    return Navigator(
      onGenerateRoute: (settings) => MaterialPageRoute<void>(builder: root, settings: settings),
    );
  }
}

/// Contenedor estándar de las pantallas de contenido: relleno y ancho máximo opcional.
class PagePadding extends StatelessWidget {
  const PagePadding({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(padding: const EdgeInsets.all(AppSpacing.xl), child: child);
  }
}
