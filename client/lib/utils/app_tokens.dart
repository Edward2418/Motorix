import 'package:flutter/material.dart';

/// Tokens del sistema de diseño de Motorix (docs/design-system.md).
/// Es la única fuente de colores, espaciados, radios y duraciones: las pantallas no escriben
/// valores sueltos.
class AppColors {
  AppColors._();

  static const Color primary = Color(0xFF9B4F55);
  static const Color sidebar = Color(0xFF2B2325);
  static const Color sidebarActive = Color(0xFF43353A);
  static const Color background = Color(0xFFF5F2F1);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color outline = Color(0xFFDDD5D4);
  static const Color textPrimary = Color(0xFF231F20);
  static const Color textSecondary = Color(0xFF6F6566);
  static const Color warning = Color(0xFFC9892B);
  static const Color success = Color(0xFF4F7A5A);
  static const Color danger = Color(0xFFC0392B);

  /// Texto e íconos sobre el sidebar oscuro.
  static const Color onSidebar = Color(0xFFF5F2F1);
  static const Color onSidebarMuted = Color(0xFFBDB2B3);

  /// Texto sobre el color de marca y sobre el fondo oscuro de los avisos.
  static const Color onPrimary = Color(0xFFFFFFFF);
}

/// Escala de espaciado base de 4 px.
class AppSpacing {
  AppSpacing._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;
}

class AppRadius {
  AppRadius._();

  /// Botones e inputs.
  static const double control = 6;

  /// Paneles, tarjetas, chips, avisos y contenedores en general.
  static const double panel = 8;

  /// Barras de progreso y elementos tipo "pill".
  static const double pill = 12;
}

/// Escala fija de 4 tamaños de letra.
class AppFontSizes {
  AppFontSizes._();

  static const double caption = 12;
  static const double body = 14;
  static const double section = 18;
  static const double title = 28;
}

class AppDurations {
  AppDurations._();

  static const Duration state = Duration(milliseconds: 150);
  static const Duration appear = Duration(milliseconds: 200);
  static const Duration navigation = Duration(milliseconds: 250);
  static const Duration sidebar = Duration(milliseconds: 200);

  /// Espera tras la última pulsación antes de buscar.
  static const Duration search = Duration(milliseconds: 350);
}

class AppSizes {
  AppSizes._();

  static const double sidebarExpanded = 260;
  static const double sidebarCollapsed = 72;
  static const double sidebarAutoCollapseWidth = 1000;
  static const double formMaxWidth = 560;
  static const double searchWidth = 320;
  static const double headerHeight = 64;
  static const double dialogWidth = 400;
  static const double authCardWidth = 400;
  static const double optionsMaxHeight = 240;
  static const double icon = 18;
  static const double cellNarrow = 160;
  static const double cellWide = 220;
  static const double spinner = 24;
  static const double spinnerSmall = 16;
  static const double historyDateWidth = 160;
}
