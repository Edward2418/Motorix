import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/user.dart';
import '../providers/auth_provider.dart';
import '../providers/sidebar_provider.dart';
import '../screens/change_password_dialog.dart';
import '../utils/app_navigation.dart';
import '../utils/app_tokens.dart';
import 'confirm_dialog.dart';

/// Estructura general: sidebar colapsable, encabezado y contenido (docs/design-system.md §7).
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;

  Future<void> _logout() async {
    final confirmed = await showConfirmDialog(context, message: '¿Seguro que quieres cerrar sesión?');
    if (confirmed && mounted) {
      context.read<AuthProvider>().logout();
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    if (user == null) {
      return const SizedBox.shrink();
    }
    final destinations = destinationsFor(user.role);
    final selected = _index.clamp(0, destinations.length - 1);
    final sidebar = context.watch<SidebarProvider>();

    return LayoutBuilder(
      builder: (context, constraints) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) {
            context.read<SidebarProvider>().adaptToWidth(constraints.maxWidth, AppSizes.sidebarAutoCollapseWidth);
          }
        });
        return Scaffold(
          body: Row(
            children: [
              _Sidebar(
                destinations: destinations,
                selectedIndex: selected,
                expanded: sidebar.expanded,
                user: user,
                onSelected: (index) => setState(() => _index = index),
                onToggle: context.read<SidebarProvider>().toggle,
                onLogout: _logout,
              ),
              Expanded(
                child: Column(
                  children: [
                    _Header(title: destinations[selected].label, user: user, onLogout: _logout),
                    Expanded(
                      child: AnimatedSwitcher(
                        duration: AppDurations.navigation,
                        switchInCurve: Curves.easeOutCubic,
                        switchOutCurve: Curves.easeOutCubic,
                        child: KeyedSubtree(
                          key: ValueKey(destinations[selected].label),
                          child: destinations[selected].builder(context),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _Sidebar extends StatelessWidget {
  const _Sidebar({
    required this.destinations,
    required this.selectedIndex,
    required this.expanded,
    required this.user,
    required this.onSelected,
    required this.onToggle,
    required this.onLogout,
  });

  final List<NavDestination> destinations;
  final int selectedIndex;
  final bool expanded;
  final User user;
  final ValueChanged<int> onSelected;
  final VoidCallback onToggle;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return AnimatedContainer(
      duration: AppDurations.sidebar,
      curve: Curves.easeInOut,
      width: expanded ? AppSizes.sidebarExpanded : AppSizes.sidebarCollapsed,
      color: AppColors.sidebar,
      child: ClipRect(
        child: NavigationRail(
          extended: expanded,
          minExtendedWidth: AppSizes.sidebarExpanded,
          selectedIndex: selectedIndex,
          onDestinationSelected: onSelected,
          labelType: NavigationRailLabelType.none,
          leading: Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
            child: IconButton(
              tooltip: expanded ? 'Contraer menú' : 'Expandir menú',
              onPressed: onToggle,
              icon: const Icon(LucideIcons.menu, color: AppColors.onSidebar),
            ),
          ),
          trailing: Expanded(
            child: Align(
              alignment: Alignment.bottomCenter,
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (expanded) ...[
                      Text(
                        user.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: textTheme.bodyMedium?.copyWith(color: AppColors.onSidebar),
                      ),
                      Text(
                        user.role.label,
                        style: textTheme.bodySmall?.copyWith(color: AppColors.onSidebarMuted),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                    ],
                    IconButton(
                      tooltip: 'Cerrar sesión',
                      onPressed: onLogout,
                      icon: const Icon(LucideIcons.logOut, color: AppColors.onSidebarMuted),
                    ),
                  ],
                ),
              ),
            ),
          ),
          destinations: [
            for (final destination in destinations)
              NavigationRailDestination(
                icon: Tooltip(message: destination.label, child: Icon(destination.icon)),
                label: Text(destination.label),
              ),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.title, required this.user, required this.onLogout});

  final String title;
  final User user;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Container(
      height: AppSizes.headerHeight,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(bottom: BorderSide(color: AppColors.outline)),
      ),
      child: Row(
        children: [
          Text(title, style: textTheme.titleLarge),
          const Spacer(),
          Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(user.name, style: textTheme.bodyMedium),
              Text(user.role.label, style: textTheme.bodySmall),
            ],
          ),
          const SizedBox(width: AppSpacing.sm),
          PopupMenuButton<String>(
            tooltip: 'Menú del perfil',
            icon: const Icon(LucideIcons.circleUser, color: AppColors.textSecondary),
            onSelected: (value) {
              if (value == 'password') {
                showChangePasswordDialog(context);
              } else if (value == 'logout') {
                onLogout();
              }
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'password', child: Text('Cambiar contraseña')),
              PopupMenuItem(value: 'logout', child: Text('Cerrar sesión')),
            ],
          ),
        ],
      ),
    );
  }
}
