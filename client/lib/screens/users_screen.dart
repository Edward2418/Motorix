import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/user.dart';
import '../providers/auth_provider.dart';
import '../providers/clients_provider.dart';
import '../providers/users_provider.dart';
import '../services/api_client.dart';
import '../utils/app_tokens.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/search_field.dart';
import '../widgets/section_navigator.dart';
import '../widgets/status_chip.dart';
import '../widgets/table_footer.dart';
import '../widgets/table_scroll.dart';
import '../widgets/view_states.dart';
import 'user_form_screen.dart';

/// Gestión de usuarios y roles (solo ADMIN).
class UsersScreen extends StatefulWidget {
  const UsersScreen({super.key});

  @override
  State<UsersScreen> createState() => _UsersScreenState();
}

class _UsersScreenState extends State<UsersScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<UsersProvider>().load());
  }

  Future<void> _openForm([User? user]) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => UserFormScreen(user: user)),
    );
    if (saved == true && mounted) {
      showFeedback(context, user == null ? 'Usuario registrado correctamente.' : 'Usuario actualizado correctamente.');
    }
  }

  Future<void> _toggleActive(User user) async {
    final deactivate = user.active;
    final confirmed = await showConfirmDialog(
      context,
      message: deactivate
          ? '¿Seguro que quieres desactivar al usuario ${user.username}? Ya no podrá iniciar sesión.'
          : '¿Seguro que quieres reactivar al usuario ${user.username}?',
    );
    if (!confirmed || !mounted) {
      return;
    }
    try {
      await context.read<UsersProvider>().setActive(user.id, !deactivate);
      if (mounted) {
        showFeedback(context, deactivate ? 'Usuario desactivado.' : 'Usuario reactivado.');
      }
    } on ApiException catch (e) {
      if (mounted) {
        showFeedback(context, e.message, error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final users = context.watch<UsersProvider>();
    final currentUserId = context.select<AuthProvider, int?>((auth) => auth.user?.id);
    final theme = Theme.of(context);

    return PagePadding(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              SizedBox(
                width: AppSizes.searchWidth,
                child: SearchField(
                  hint: 'Buscar por usuario, nombre o correo',
                  onChanged: (value) => context.read<UsersProvider>().setSearch(value),
                ),
              ),
              const SizedBox(width: AppSpacing.lg),
              DropdownButtonHideUnderline(
                child: DropdownButton<ActiveFilter>(
                  value: users.filter,
                  borderRadius: BorderRadius.circular(AppRadius.panel),
                  style: theme.textTheme.bodyMedium,
                  items: [
                    for (final filter in ActiveFilter.values)
                      DropdownMenuItem(value: filter, child: Text(filter.label)),
                  ],
                  onChanged: (value) {
                    if (value != null) {
                      context.read<UsersProvider>().setFilter(value);
                    }
                  },
                ),
              ),
              const Spacer(),
              FilledButton.icon(
                onPressed: () => _openForm(),
                icon: const Icon(LucideIcons.plus, size: AppSizes.icon),
                label: const Text('Registrar usuario'),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Expanded(
            child: Card(
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  Expanded(child: _buildBody(context, users, currentUserId)),
                  const Divider(),
                  TableFooter(
                    page: users.page,
                    pageSize: UsersProvider.pageSize,
                    total: users.total,
                    onPageChanged: (page) => context.read<UsersProvider>().goToPage(page),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(BuildContext context, UsersProvider users, int? currentUserId) {
    if (users.loading && users.items.isEmpty) {
      return const LoadingState();
    }
    if (users.error != null) {
      return ErrorState(message: users.error!, onRetry: () => context.read<UsersProvider>().load());
    }
    if (users.items.isEmpty) {
      return EmptyState(
        message: users.search.isEmpty
            ? 'Todavía no hay usuarios en esta lista.'
            : 'No se encontraron usuarios con esa búsqueda.',
      );
    }
    return TableScroll(
      child: DataTable(
          columns: const [
            DataColumn(label: Text('Usuario')),
            DataColumn(label: Text('Nombre')),
            DataColumn(label: Text('Correo')),
            DataColumn(label: Text('Rol')),
            DataColumn(label: Text('Estado')),
            DataColumn(label: Text('Acciones')),
          ],
          rows: [
            for (final user in users.items)
              DataRow(
                cells: [
                  DataCell(Text(user.username)),
                  DataCell(Text(user.name)),
                  DataCell(Text(user.email)),
                  DataCell(Text(user.role.label)),
                  DataCell(StatusChip(active: user.active)),
                  DataCell(
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          tooltip: 'Editar usuario',
                          onPressed: () => _openForm(user),
                          icon: const Icon(LucideIcons.pencil, size: AppSizes.icon),
                        ),
                        if (user.id != currentUserId)
                          IconButton(
                            tooltip: user.active ? 'Desactivar usuario' : 'Reactivar usuario',
                            onPressed: () => _toggleActive(user),
                            icon: Icon(user.active ? LucideIcons.ban : LucideIcons.rotateCcw, size: AppSizes.icon),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
          ],
      ),
    );
  }
}
