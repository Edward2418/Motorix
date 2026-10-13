import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_tokens.dart';

/// Tema Material 3 propio de Motorix. Única fuente de estilos de la aplicación.
final ColorScheme motorixScheme = ColorScheme.fromSeed(
  seedColor: AppColors.primary,
  brightness: Brightness.light,
).copyWith(
  primary: AppColors.primary,
  onPrimary: AppColors.onPrimary,
  surface: AppColors.surface,
  surfaceContainerLowest: AppColors.background,
  outline: AppColors.outline,
  outlineVariant: AppColors.outline,
  onSurface: AppColors.textPrimary,
  onSurfaceVariant: AppColors.textSecondary,
  error: AppColors.danger,
);

/// [useGoogleFonts] se desactiva en las pruebas para no descargar la tipografía.
ThemeData buildAppTheme({bool useGoogleFonts = true}) {
  final base = ThemeData(useMaterial3: true, colorScheme: motorixScheme);

  TextStyle style(double size, FontWeight weight, {Color color = AppColors.textPrimary}) {
    final fallback = TextStyle(fontSize: size, fontWeight: weight, color: color);
    if (!useGoogleFonts) {
      return fallback;
    }
    return GoogleFonts.ibmPlexSans(fontSize: size, fontWeight: weight, color: color);
  }

  // Escala de 4 tamaños: caption 12, cuerpo 14, sección 18 y título 28.
  final textTheme = base.textTheme.copyWith(
    displayLarge: style(AppFontSizes.title, FontWeight.w600),
    displayMedium: style(AppFontSizes.title, FontWeight.w600),
    displaySmall: style(AppFontSizes.title, FontWeight.w600),
    headlineLarge: style(AppFontSizes.title, FontWeight.w600),
    headlineMedium: style(AppFontSizes.title, FontWeight.w600),
    headlineSmall: style(AppFontSizes.section, FontWeight.w600),
    titleLarge: style(AppFontSizes.section, FontWeight.w600),
    titleMedium: style(AppFontSizes.body, FontWeight.w500),
    titleSmall: style(AppFontSizes.body, FontWeight.w500),
    bodyLarge: style(AppFontSizes.body, FontWeight.w400),
    bodyMedium: style(AppFontSizes.body, FontWeight.w400),
    bodySmall: style(AppFontSizes.caption, FontWeight.w400, color: AppColors.textSecondary),
    labelLarge: style(AppFontSizes.body, FontWeight.w500),
    labelMedium: style(AppFontSizes.caption, FontWeight.w400),
    labelSmall: style(AppFontSizes.caption, FontWeight.w400),
  );

  final controlShape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.control));
  final panelShape = RoundedRectangleBorder(
    borderRadius: BorderRadius.circular(AppRadius.panel),
    side: const BorderSide(color: AppColors.outline),
  );
  final inputBorder = OutlineInputBorder(
    borderRadius: BorderRadius.circular(AppRadius.control),
    borderSide: const BorderSide(color: AppColors.outline),
  );

  return base.copyWith(
    scaffoldBackgroundColor: AppColors.background,
    textTheme: textTheme,
    primaryTextTheme: textTheme,
    dividerTheme: const DividerThemeData(color: AppColors.outline, thickness: 1, space: 1),
    cardTheme: CardThemeData(
      color: AppColors.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: panelShape,
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: AppColors.surface,
      elevation: 0,
      shape: panelShape,
      titleTextStyle: textTheme.titleLarge,
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: AppColors.textPrimary,
      contentTextStyle: style(AppFontSizes.body, FontWeight.w400, color: AppColors.onPrimary),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.panel)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.md),
      border: inputBorder,
      enabledBorder: inputBorder,
      focusedBorder: inputBorder.copyWith(
        borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
      ),
      errorBorder: inputBorder.copyWith(borderSide: const BorderSide(color: AppColors.danger)),
      focusedErrorBorder: inputBorder.copyWith(
        borderSide: const BorderSide(color: AppColors.danger, width: 1.5),
      ),
      labelStyle: style(AppFontSizes.body, FontWeight.w400, color: AppColors.textSecondary),
      errorStyle: style(AppFontSizes.caption, FontWeight.w400, color: AppColors.danger),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.onPrimary,
        shape: controlShape,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
        textStyle: textTheme.labelLarge,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.textPrimary,
        side: const BorderSide(color: AppColors.outline),
        shape: controlShape,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
        textStyle: textTheme.labelLarge,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.primary,
        shape: controlShape,
        textStyle: textTheme.labelLarge,
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: AppColors.background,
      side: const BorderSide(color: AppColors.outline),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.panel)),
      labelStyle: textTheme.bodySmall,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
    ),
    dataTableTheme: DataTableThemeData(
      headingTextStyle: style(AppFontSizes.caption, FontWeight.w500, color: AppColors.textSecondary),
      dataTextStyle: textTheme.bodyMedium,
      dividerThickness: 1,
      columnSpacing: AppSpacing.xl,
      horizontalMargin: AppSpacing.lg,
      headingRowColor: const WidgetStatePropertyAll(AppColors.background),
      dataRowColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.hovered)) {
          return AppColors.background;
        }
        return AppColors.surface;
      }),
    ),
    tooltipTheme: TooltipThemeData(
      decoration: BoxDecoration(
        color: AppColors.textPrimary,
        borderRadius: BorderRadius.circular(AppRadius.control),
      ),
      textStyle: style(AppFontSizes.caption, FontWeight.w400, color: AppColors.onPrimary),
      waitDuration: const Duration(milliseconds: 400),
    ),
    navigationRailTheme: NavigationRailThemeData(
      backgroundColor: AppColors.sidebar,
      indicatorColor: AppColors.sidebarActive,
      indicatorShape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.control)),
      selectedIconTheme: const IconThemeData(color: AppColors.onSidebar),
      unselectedIconTheme: const IconThemeData(color: AppColors.onSidebarMuted),
      selectedLabelTextStyle: style(AppFontSizes.body, FontWeight.w500, color: AppColors.onSidebar),
      unselectedLabelTextStyle:
          style(AppFontSizes.body, FontWeight.w400, color: AppColors.onSidebarMuted),
    ),
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.windows: _DiscreteTransitionsBuilder(),
        TargetPlatform.linux: _DiscreteTransitionsBuilder(),
        TargetPlatform.macOS: _DiscreteTransitionsBuilder(),
        TargetPlatform.android: _DiscreteTransitionsBuilder(),
        TargetPlatform.iOS: _DiscreteTransitionsBuilder(),
      },
    ),
  );
}

/// Transición discreta entre pantallas: fundido con un desplazamiento leve (250 ms).
class _DiscreteTransitionsBuilder extends PageTransitionsBuilder {
  const _DiscreteTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    final curved = CurvedAnimation(parent: animation, curve: Curves.easeOutCubic);
    return FadeTransition(
      opacity: curved,
      child: SlideTransition(
        position: Tween<Offset>(begin: const Offset(0.02, 0), end: Offset.zero).animate(curved),
        child: child,
      ),
    );
  }
}
