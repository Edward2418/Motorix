import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

import 'providers/appointments_provider.dart';
import 'providers/audit_provider.dart';
import 'providers/auth_provider.dart';
import 'providers/client_notices_provider.dart';
import 'providers/clients_provider.dart';
import 'providers/dashboard_provider.dart';
import 'providers/maintenance_provider.dart';
import 'providers/navigation_provider.dart';
import 'providers/notifications_provider.dart';
import 'providers/payments_provider.dart';
import 'providers/reports_provider.dart';
import 'providers/service_types_provider.dart';
import 'providers/settings_provider.dart';
import 'providers/terms_provider.dart';
import 'providers/ticket_provider.dart';
import 'services/ticket_printer.dart';
import 'providers/orders_provider.dart';
import 'providers/parts_provider.dart';
import 'providers/sidebar_provider.dart';
import 'providers/users_provider.dart';
import 'providers/vehicles_provider.dart';
import 'screens/login_screen.dart';
import 'screens/terms_screen.dart';
import 'services/api_client.dart';
import 'utils/app_theme.dart';
import 'widgets/app_shell.dart';
import 'widgets/inactivity_guard.dart';

void main() {
  runApp(MotorixApp(api: ApiClient()));
}

/// Aplicación raíz. [useGoogleFonts] se desactiva en las pruebas para no descargar la tipografía.
class MotorixApp extends StatelessWidget {
  const MotorixApp({super.key, required this.api, this.useGoogleFonts = true});

  final ApiClient api;
  final bool useGoogleFonts;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: api),
        ChangeNotifierProvider(create: (_) => AuthProvider(api)),
        ChangeNotifierProvider(create: (_) => SidebarProvider()),
        ChangeNotifierProvider(create: (_) => NavigationProvider()),
        ChangeNotifierProvider(create: (_) => ClientsProvider(api)),
        ChangeNotifierProvider(create: (_) => VehiclesProvider(api)),
        ChangeNotifierProvider(create: (_) => UsersProvider(api)),
        ChangeNotifierProvider(create: (_) => OrdersProvider(api)),
        ChangeNotifierProvider(create: (_) => AppointmentsProvider(api)),
        ChangeNotifierProvider(create: (_) => PartsProvider(api)),
        ChangeNotifierProvider(create: (_) => MaintenanceProvider(api)),
        ChangeNotifierProvider(create: (_) => PaymentsProvider(api)),
        ChangeNotifierProvider(create: (_) => TicketProvider(api)),
        ChangeNotifierProvider(create: (_) => DashboardProvider(api)),
        ChangeNotifierProvider(create: (_) => NotificationsProvider(api)),
        ChangeNotifierProvider(create: (_) => ClientNoticesProvider(api)),
        ChangeNotifierProvider(create: (_) => SettingsProvider(api)),
        ChangeNotifierProvider(create: (_) => AuditProvider(api)),
        ChangeNotifierProvider(create: (_) => TermsProvider(api)),
        ChangeNotifierProvider(create: (_) => ServiceTypesProvider(api)),
        ChangeNotifierProvider(create: (_) => ReportsProvider(api)),
        // La impresión es una dependencia reemplazable: las pruebas usan una impresora falsa.
        Provider<TicketPrinter>.value(value: const PdfTicketPrinter()),
      ],
      child: MaterialApp(
        title: 'Motorix',
        debugShowCheckedModeBanner: false,
        theme: buildAppTheme(useGoogleFonts: useGoogleFonts),
        // Selectores de fecha y hora en español.
        locale: const Locale('es', 'MX'),
        supportedLocales: const [Locale('es', 'MX'), Locale('es')],
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        // Cierra la sesión tras 30 minutos sin actividad.
        builder: (context, child) => InactivityGuard(child: child ?? const SizedBox.shrink()),
        home: const _SessionGate(),
      ),
    );
  }
}

/// Muestra el inicio de sesión o la aplicación según el estado de la sesión.
class _SessionGate extends StatelessWidget {
  const _SessionGate();

  @override
  Widget build(BuildContext context) {
    final authenticated = context.select<AuthProvider, bool>((auth) => auth.isAuthenticated);
    final termsPending = context.select<AuthProvider, bool>((auth) => auth.termsPending);
    if (!authenticated) {
      return const LoginScreen();
    }
    // Con términos pendientes no se muestra ningún módulo hasta aceptarlos.
    return termsPending ? const TermsScreen() : const AppShell();
  }
}
