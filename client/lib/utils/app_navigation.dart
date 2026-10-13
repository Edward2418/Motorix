import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../models/user.dart';
import '../screens/clients_screen.dart';
import '../screens/users_screen.dart';
import '../screens/vehicles_screen.dart';
import '../widgets/section_navigator.dart';

/// Entrada del menú lateral. Solo se listan los módulos implementados en el sprint actual.
class NavDestination {
  const NavDestination({
    required this.label,
    required this.icon,
    required this.roles,
    required this.builder,
  });

  final String label;
  final IconData icon;

  /// Roles que ven la entrada. Ocultar un botón no es seguridad: el backend valida los permisos.
  final Set<UserRole> roles;
  final WidgetBuilder builder;
}

/// Pantalla provisional de un módulo cuyo desarrollo llega en una historia posterior del sprint.
Widget pendingScreen(String name) => Builder(
      builder: (context) => Center(
        child: Text('$name estará disponible próximamente.', style: Theme.of(context).textTheme.bodyLarge),
      ),
    );

/// Destinos del menú, en orden. Cada historia reemplaza la pantalla provisional por la real.
final List<NavDestination> allDestinations = [
  NavDestination(
    label: 'Clientes',
    icon: LucideIcons.users,
    roles: UserRole.values.toSet(),
    builder: (_) => const SectionNavigator(root: _clientsRoot),
  ),
  NavDestination(
    label: 'Vehículos',
    icon: LucideIcons.car,
    roles: UserRole.values.toSet(),
    builder: (_) => const SectionNavigator(root: _vehiclesRoot),
  ),
  NavDestination(
    label: 'Usuarios',
    icon: LucideIcons.userCog,
    roles: {UserRole.admin},
    builder: (_) => const SectionNavigator(root: _usersRoot),
  ),
];

List<NavDestination> destinationsFor(UserRole role) =>
    allDestinations.where((destination) => destination.roles.contains(role)).toList();

Widget _clientsRoot(BuildContext context) => const ClientsScreen();

Widget _vehiclesRoot(BuildContext context) => const VehiclesScreen();

Widget _usersRoot(BuildContext context) => const UsersScreen();
