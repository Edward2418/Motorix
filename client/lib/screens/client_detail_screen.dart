import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/client.dart';
import '../models/vehicle.dart';
import '../providers/auth_provider.dart';
import '../providers/clients_provider.dart';
import '../providers/vehicles_provider.dart';
import '../services/api_client.dart';
import '../utils/app_tokens.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/section_navigator.dart';
import '../widgets/status_chip.dart';
import '../widgets/table_scroll.dart';
import '../widgets/view_states.dart';
import 'client_form_screen.dart';
import 'vehicle_form_screen.dart';

/// Detalle de un cliente: sus datos y los vehículos asociados.
class ClientDetailScreen extends StatefulWidget {
  const ClientDetailScreen({super.key, required this.clientId});

  final int clientId;

  @override
  State<ClientDetailScreen> createState() => _ClientDetailScreenState();
}

class _ClientDetailScreenState extends State<ClientDetailScreen> {
  Client? _client;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final client = await context.read<ClientsProvider>().fetch(widget.clientId);
      if (mounted) {
        setState(() => _client = client);
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _error = e.message);
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _edit() async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => ClientFormScreen(client: _client)),
    );
    if (saved == true && mounted) {
      showFeedback(context, 'Cliente actualizado correctamente.');
      await _load();
    }
  }

  Future<void> _toggleActive() async {
    final client = _client!;
    final deactivate = client.active;
    final confirmed = await showConfirmDialog(
      context,
      message: deactivate
          ? '¿Seguro que quieres desactivar al cliente ${client.name}?'
          : '¿Seguro que quieres reactivar al cliente ${client.name}?',
    );
    if (!confirmed || !mounted) {
      return;
    }
    try {
      await context.read<ClientsProvider>().setActive(client.id, !deactivate);
      if (!mounted) {
        return;
      }
      showFeedback(context, deactivate ? 'Cliente desactivado.' : 'Cliente reactivado.');
      await _load();
    } on ApiException catch (e) {
      // Por ejemplo, el cliente todavía tiene vehículos activos.
      if (mounted) {
        showFeedback(context, e.message, error: true);
      }
    }
  }

  Future<void> _registerVehicle() async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => VehicleFormScreen(initialOwner: _client)),
    );
    if (saved == true && mounted) {
      showFeedback(context, 'Vehículo registrado correctamente.');
      await _load();
    }
  }

  Future<void> _toggleVehicle(Vehicle vehicle) async {
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
      if (!mounted) {
        return;
      }
      showFeedback(context, deactivate ? 'Vehículo desactivado.' : 'Vehículo reactivado.');
      await _load();
    } on ApiException catch (e) {
      if (mounted) {
        showFeedback(context, e.message, error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_client?.name ?? 'Detalle del cliente'),
        backgroundColor: AppColors.surface,
        scrolledUnderElevation: 0,
      ),
      body: _buildBody(context),
    );
  }

  Widget _buildBody(BuildContext context) {
    if (_loading) {
      return const LoadingState();
    }
    if (_error != null) {
      return ErrorState(message: _error!, onRetry: _load);
    }
    final client = _client!;
    final theme = Theme.of(context);
    final canWrite = context.select<AuthProvider, bool>((auth) => auth.user?.role.canManageRecords ?? false);
    return PagePadding(
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.xl),
                child: Wrap(
                  spacing: AppSpacing.xxl,
                  runSpacing: AppSpacing.lg,
                  children: [
                    _Field(label: 'Nombre', value: client.name),
                    _Field(label: 'Teléfono', value: client.phone),
                    _Field(label: 'Correo electrónico', value: client.email ?? '—'),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Estado', style: theme.textTheme.bodySmall),
                        const SizedBox(height: AppSpacing.xs),
                        StatusChip(active: client.active),
                      ],
                    ),
                    if (canWrite)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          OutlinedButton.icon(
                            onPressed: _edit,
                            icon: const Icon(LucideIcons.pencil, size: AppSizes.icon),
                            label: const Text('Editar'),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          OutlinedButton.icon(
                            onPressed: _toggleActive,
                            icon: Icon(client.active ? LucideIcons.ban : LucideIcons.rotateCcw, size: AppSizes.icon),
                            label: Text(client.active ? 'Desactivar' : 'Reactivar'),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            Row(
              children: [
                Text('Vehículos', style: theme.textTheme.titleLarge),
                const Spacer(),
                if (canWrite && client.active)
                  FilledButton.icon(
                    onPressed: _registerVehicle,
                    icon: const Icon(LucideIcons.plus, size: AppSizes.icon),
                    label: const Text('Registrar vehículo'),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Card(
              clipBehavior: Clip.antiAlias,
              child: client.vehicles.isEmpty
                  ? const EmptyState(message: 'Este cliente todavía no tiene vehículos registrados.')
                  : TableScroll(
                      child: DataTable(
                        columns: const [
                          DataColumn(label: Text('Placa')),
                          DataColumn(label: Text('Vehículo')),
                          DataColumn(label: Text('VIN')),
                          DataColumn(label: Text('Estado')),
                          DataColumn(label: Text('Acciones')),
                        ],
                        rows: [
                          for (final vehicle in client.vehicles)
                            DataRow(
                              cells: [
                                DataCell(Text(vehicle.licensePlate)),
                                DataCell(Text(vehicle.description)),
                                DataCell(Text(vehicle.vin ?? '—')),
                                DataCell(StatusChip(active: vehicle.active)),
                                DataCell(
                                  canWrite
                                      ? IconButton(
                                          tooltip: vehicle.active ? 'Desactivar vehículo' : 'Reactivar vehículo',
                                          onPressed: () => _toggleVehicle(vehicle),
                                          icon: Icon(
                                            vehicle.active ? LucideIcons.ban : LucideIcons.rotateCcw,
                                            size: AppSizes.icon,
                                          ),
                                        )
                                      : const SizedBox.shrink(),
                                ),
                              ],
                            ),
                        ],
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: theme.textTheme.bodySmall),
        const SizedBox(height: AppSpacing.xs),
        Text(value, style: theme.textTheme.bodyLarge),
      ],
    );
  }
}
