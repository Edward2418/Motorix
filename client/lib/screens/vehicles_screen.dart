import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/vehicle.dart';
import '../providers/auth_provider.dart';
import '../providers/clients_provider.dart';
import '../providers/vehicles_provider.dart';
import '../services/api_client.dart';
import '../utils/app_tokens.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/search_field.dart';
import '../widgets/section_navigator.dart';
import '../widgets/status_chip.dart';
import '../widgets/table_footer.dart';
import '../widgets/table_scroll.dart';
import '../widgets/view_states.dart';
import 'client_detail_screen.dart';
import 'vehicle_form_screen.dart';

/// Listado de vehículos con búsqueda, filtro de estado y paginación.
class VehiclesScreen extends StatefulWidget {
  const VehiclesScreen({super.key});

  @override
  State<VehiclesScreen> createState() => _VehiclesScreenState();
}

class _VehiclesScreenState extends State<VehiclesScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<VehiclesProvider>().load());
  }

  Future<void> _openForm() async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const VehicleFormScreen()),
    );
    if (saved == true && mounted) {
      showFeedback(context, 'Vehículo registrado correctamente.');
    }
  }

  Future<void> _toggleActive(Vehicle vehicle) async {
    final deactivate = vehicle.active;
    final confirmed = await showConfirmDialog(
      context,
      message: deactivate
          ? '¿Seguro que quieres desactivar el vehículo ${vehicle.licensePlate}?'
          : '¿Seguro que quieres reactivar el vehículo ${vehicle.licensePlate}?',
    );
    if (!confirmed || !mounted) {
      return;
    }
    try {
      await context.read<VehiclesProvider>().setActive(vehicle.id, !deactivate);
      if (mounted) {
        showFeedback(context, deactivate ? 'Vehículo desactivado.' : 'Vehículo reactivado.');
      }
    } on ApiException catch (e) {
      if (mounted) {
        showFeedback(context, e.message, error: true);
      }
    }
  }

  void _openOwner(Vehicle vehicle) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => ClientDetailScreen(clientId: vehicle.clientId)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final vehicles = context.watch<VehiclesProvider>();
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
                  hint: 'Buscar por placa, marca, modelo o propietario',
                  onChanged: (value) => context.read<VehiclesProvider>().setSearch(value),
                ),
              ),
              const SizedBox(width: AppSpacing.lg),
              DropdownButtonHideUnderline(
                child: DropdownButton<ActiveFilter>(
                  value: vehicles.filter,
                  borderRadius: BorderRadius.circular(AppRadius.panel),
                  style: theme.textTheme.bodyMedium,
                  items: [
                    for (final filter in ActiveFilter.values)
                      DropdownMenuItem(value: filter, child: Text(filter.label)),
                  ],
                  onChanged: (value) {
                    if (value != null) {
                      context.read<VehiclesProvider>().setFilter(value);
                    }
                  },
                ),
              ),
              const Spacer(),
              if (canWrite)
                FilledButton.icon(
                  onPressed: _openForm,
                  icon: const Icon(LucideIcons.plus, size: AppSizes.icon),
                  label: const Text('Registrar vehículo'),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Expanded(
            child: Card(
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  Expanded(child: _buildBody(context, vehicles, canWrite)),
                  const Divider(),
                  TableFooter(
                    page: vehicles.page,
                    pageSize: VehiclesProvider.pageSize,
                    total: vehicles.total,
                    onPageChanged: (page) => context.read<VehiclesProvider>().goToPage(page),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(BuildContext context, VehiclesProvider vehicles, bool canWrite) {
    if (vehicles.loading && vehicles.items.isEmpty) {
      return const LoadingState();
    }
    if (vehicles.error != null) {
      return ErrorState(message: vehicles.error!, onRetry: () => context.read<VehiclesProvider>().load());
    }
    if (vehicles.items.isEmpty) {
      return EmptyState(
        message: vehicles.search.isEmpty
            ? 'Todavía no hay vehículos en esta lista.'
            : 'No se encontraron vehículos con esa búsqueda.',
        actionLabel: canWrite && vehicles.search.isEmpty ? 'Registrar vehículo' : null,
        onAction: canWrite ? _openForm : null,
      );
    }
    return TableScroll(
      child: DataTable(
          columns: const [
            DataColumn(label: Text('Placa')),
            DataColumn(label: Text('Vehículo')),
            DataColumn(label: Text('Propietario')),
            DataColumn(label: Text('Kilometraje'), numeric: true),
            DataColumn(label: Text('Estado')),
            DataColumn(label: Text('Acciones')),
          ],
          rows: [
            for (final vehicle in vehicles.items)
              DataRow(
                cells: [
                  DataCell(Text(vehicle.licensePlate)),
                  DataCell(Text(vehicle.description)),
                  DataCell(Text(vehicle.clientName), onTap: () => _openOwner(vehicle)),
                  DataCell(Text('${vehicle.currentMileage} km')),
                  DataCell(StatusChip(active: vehicle.active)),
                  DataCell(
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          tooltip: 'Ver propietario',
                          onPressed: () => _openOwner(vehicle),
                          icon: const Icon(LucideIcons.eye, size: AppSizes.icon),
                        ),
                        if (canWrite)
                          IconButton(
                            tooltip: vehicle.active ? 'Desactivar vehículo' : 'Reactivar vehículo',
                            onPressed: () => _toggleActive(vehicle),
                            icon: Icon(vehicle.active ? LucideIcons.ban : LucideIcons.rotateCcw, size: AppSizes.icon),
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
