import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/clients_provider.dart';
import '../utils/app_tokens.dart';
import '../widgets/search_field.dart';
import '../widgets/section_navigator.dart';
import '../widgets/status_chip.dart';
import '../widgets/table_footer.dart';
import '../widgets/table_scroll.dart';
import '../widgets/view_states.dart';
import 'client_detail_screen.dart';
import 'client_form_screen.dart';

/// Listado de clientes con búsqueda, filtro de estado y paginación.
class ClientsScreen extends StatefulWidget {
  const ClientsScreen({super.key});

  @override
  State<ClientsScreen> createState() => _ClientsScreenState();
}

class _ClientsScreenState extends State<ClientsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<ClientsProvider>().load());
  }

  Future<void> _openForm() async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const ClientFormScreen()),
    );
    if (saved == true && mounted) {
      showFeedback(context, 'Cliente registrado correctamente.');
    }
  }

  void _openDetail(int id) {
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => ClientDetailScreen(clientId: id)));
  }

  @override
  Widget build(BuildContext context) {
    final clients = context.watch<ClientsProvider>();
    final canWrite = context.select<AuthProvider, bool>((auth) => auth.user?.role.canManageRecords ?? false);
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
                  hint: 'Buscar por nombre, teléfono o correo',
                  onChanged: (value) => context.read<ClientsProvider>().setSearch(value),
                ),
              ),
              const SizedBox(width: AppSpacing.lg),
              DropdownButtonHideUnderline(
                child: DropdownButton<ActiveFilter>(
                  value: clients.filter,
                  borderRadius: BorderRadius.circular(AppRadius.panel),
                  style: theme.textTheme.bodyMedium,
                  items: [
                    for (final filter in ActiveFilter.values)
                      DropdownMenuItem(value: filter, child: Text(filter.label)),
                  ],
                  onChanged: (value) {
                    if (value != null) {
                      context.read<ClientsProvider>().setFilter(value);
                    }
                  },
                ),
              ),
              const Spacer(),
              if (canWrite)
                FilledButton.icon(
                  onPressed: _openForm,
                  icon: const Icon(LucideIcons.plus, size: AppSizes.icon),
                  label: const Text('Registrar cliente'),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Expanded(
            child: Card(
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  Expanded(child: _buildBody(context, clients, canWrite)),
                  const Divider(),
                  TableFooter(
                    page: clients.page,
                    pageSize: ClientsProvider.pageSize,
                    total: clients.total,
                    onPageChanged: (page) => context.read<ClientsProvider>().goToPage(page),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(BuildContext context, ClientsProvider clients, bool canWrite) {
    if (clients.loading && clients.items.isEmpty) {
      return const LoadingState();
    }
    if (clients.error != null) {
      return ErrorState(message: clients.error!, onRetry: () => context.read<ClientsProvider>().load());
    }
    if (clients.items.isEmpty) {
      return EmptyState(
        message: clients.search.isEmpty
            ? 'Todavía no hay clientes en esta lista.'
            : 'No se encontraron clientes con esa búsqueda.',
        actionLabel: canWrite && clients.search.isEmpty ? 'Registrar cliente' : null,
        onAction: canWrite ? _openForm : null,
      );
    }
    return TableScroll(
      child: DataTable(
          showCheckboxColumn: false,
          columns: const [
            DataColumn(label: Text('Nombre')),
            DataColumn(label: Text('Teléfono')),
            DataColumn(label: Text('Correo')),
            DataColumn(label: Text('Vehículos'), numeric: true),
            DataColumn(label: Text('Estado')),
            DataColumn(label: Text('Acciones')),
          ],
          rows: [
            for (final client in clients.items)
              DataRow(
                onSelectChanged: (_) => _openDetail(client.id),
                cells: [
                  DataCell(Text(client.name)),
                  DataCell(Text(client.phone)),
                  DataCell(Text(client.email ?? '—')),
                  DataCell(Text('${client.vehicleCount}')),
                  DataCell(StatusChip(active: client.active)),
                  DataCell(
                    IconButton(
                      tooltip: 'Ver detalle',
                      onPressed: () => _openDetail(client.id),
                      icon: const Icon(LucideIcons.eye, size: AppSizes.icon),
                    ),
                  ),
                ],
              ),
          ],
      ),
    );
  }
}
