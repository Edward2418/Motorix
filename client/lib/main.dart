import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

import 'providers/appointments_provider.dart';
import 'providers/auth_provider.dart';
import 'providers/clients_provider.dart';
import 'providers/maintenance_provider.dart';
import 'providers/payments_provider.dart';
import 'providers/orders_provider.dart';
import 'providers/parts_provider.dart';
import 'providers/sidebar_provider.dart';
import 'providers/users_provider.dart';
import 'providers/vehicles_provider.dart';
import 'screens/login_screen.dart';
import 'services/api_client.dart';
import 'utils/app_theme.dart';
import 'widgets/app_shell.dart';

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
        ChangeNotifierProvider(create: (_) => ClientsProvider(api)),
        ChangeNotifierProvider(create: (_) => VehiclesProvider(api)),
        ChangeNotifierProvider(create: (_) => UsersProvider(api)),
        ChangeNotifierProvider(create: (_) => OrdersProvider(api)),
        ChangeNotifierProvider(create: (_) => AppointmentsProvider(api)),
        ChangeNotifierProvider(create: (_) => PartsProvider(api)),
        ChangeNotifierProvider(create: (_) => MaintenanceProvider(api)),
        ChangeNotifierProvider(create: (_) => PaymentsProvider(api)),
      ],
      child: MaterialApp(
        title: 'Motorix',
        debugShowCheckedModeBanner: false,
        theme: buildAppTheme(useGoogleFonts: useGoogleFonts),
        // Selectores de fecha y hora en español.
        locale: const Locale('es', 'MX'),
        supportedLocales: const [Locale('es', 'MX'), Locale('es')],
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
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
    return authenticated ? const AppShell() : const LoginScreen();
  }
}
