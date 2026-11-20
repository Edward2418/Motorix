import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/app_settings.dart';
import '../models/service_type.dart';
import '../providers/service_types_provider.dart';
import '../providers/settings_provider.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/status_chip.dart';
import '../providers/terms_provider.dart';
import '../widgets/table_footer.dart';
import '../services/api_client.dart';
import '../utils/app_tokens.dart';
import '../utils/formatters.dart';
import '../widgets/section_navigator.dart';
import '../widgets/view_states.dart';

/// Configuración del taller (solo administración). Cada sección es una tarjeta: datos del taller y, en las historias
/// siguientes del sprint, márgenes de «Próximo», tipos de servicio y términos.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<SettingsProvider>().load();
      context.read<ServiceTypesProvider>().load();
      final terms = context.read<TermsProvider>();
      terms.load();
      terms.loadAcceptances();
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<SettingsProvider>();
    final settings = provider.settings;
    if (provider.loading && settings == null) {
      return const LoadingState();
    }
    if (provider.error != null && settings == null) {
      return ErrorState(message: provider.error!, onRetry: () => context.read<SettingsProvider>().load());
    }
    if (settings == null) {
      return const LoadingState();
    }
    return PagePadding(
      child: SingleChildScrollView(
        child: Align(
          alignment: Alignment.topLeft,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: AppSizes.formMaxWidth),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _WorkshopCard(settings: settings),
                const SizedBox(height: AppSpacing.lg),
                _MaintenanceCard(settings: settings),
                const SizedBox(height: AppSpacing.lg),
                const _ServiceTypesCard(),
                const SizedBox(height: AppSpacing.lg),
                const _TermsCard(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Texto de origen de un grupo de valores: si ya se guardó desde la aplicación (con quién y cuándo) o si aún son los
/// valores iniciales del servidor.
String sourceText(SettingSource source, {String? updatedByName, DateTime? updatedAt}) {
  if (source != SettingSource.saved) {
    return 'Aún se muestran los valores iniciales del servidor: todavía no se ha guardado ningún cambio desde la aplicación.';
  }
  final by = updatedByName == null ? '' : ' por $updatedByName';
  final at = updatedAt == null ? '' : ' el ${formatDateTime(updatedAt)}';
  return 'Guardado desde la aplicación$by$at.';
}

class _WorkshopCard extends StatefulWidget {
  const _WorkshopCard({required this.settings});

  final AppSettings settings;

  @override
  State<_WorkshopCard> createState() => _WorkshopCardState();
}

class _WorkshopCardState extends State<_WorkshopCard> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name = TextEditingController(text: widget.settings.workshop.name);
  late final TextEditingController _address = TextEditingController(text: widget.settings.workshop.address);
  late final TextEditingController _phone = TextEditingController(text: widget.settings.workshop.phone);

  bool _saving = false;
  String? _generalError;
  Map<String, String> _serverErrors = const {};

  @override
  void dispose() {
    for (final controller in [_name, _address, _phone]) {
      controller.dispose();
    }
    super.dispose();
  }

  String? _validate(String? value, {required String label, required int max}) {
    final text = (value ?? '').trim();
    if (text.isEmpty) {
      return '$label es obligatorio.';
    }
    if (text.length > max) {
      return '$label no puede pasar de $max caracteres.';
    }
    return null;
  }

  Future<void> _save() async {
    setState(() {
      _generalError = null;
      _serverErrors = const {};
    });
    if (!_formKey.currentState!.validate()) {
      return;
    }
    setState(() => _saving = true);
    final provider = context.read<SettingsProvider>();
    try {
      await provider.saveWorkshop(name: _name.text.trim(), address: _address.text.trim(), phone: _phone.text.trim());
      if (!mounted) {
        return;
      }
      final saved = provider.settings!.workshop;
      _name.text = saved.name;
      _address.text = saved.address;
      _phone.text = saved.phone;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Datos del taller guardados.')));
    } on ApiException catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _saving = false;
        _serverErrors = e.fieldErrors;
        _generalError = e.fieldErrors.isEmpty ? e.message : null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final settings = widget.settings;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Datos del taller', style: theme.textTheme.titleMedium),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Aparecen en el encabezado de los tickets nuevos. Los tickets ya emitidos conservan los datos con los que se emitieron.',
                style: theme.textTheme.bodySmall,
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                sourceText(settings.workshop.source, updatedByName: settings.updatedByName, updatedAt: settings.updatedAt),
                style: theme.textTheme.bodySmall,
              ),
              const SizedBox(height: AppSpacing.lg),
              TextFormField(
                controller: _name,
                decoration: InputDecoration(labelText: 'Nombre del taller', errorText: _serverErrors['workshop.name']),
                validator: (value) => _validate(value, label: 'El nombre del taller', max: 100),
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _address,
                decoration: InputDecoration(labelText: 'Dirección', errorText: _serverErrors['workshop.address']),
                validator: (value) => _validate(value, label: 'La dirección del taller', max: 200),
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _phone,
                decoration: InputDecoration(labelText: 'Teléfono', errorText: _serverErrors['workshop.phone']),
                validator: (value) => _validate(value, label: 'El teléfono del taller', max: 30),
              ),
              if (_generalError != null) ...[
                const SizedBox(height: AppSpacing.md),
                Text(_generalError!, style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.danger)),
              ],
              const SizedBox(height: AppSpacing.lg),
              Align(
                alignment: Alignment.centerLeft,
                child: FilledButton(
                  onPressed: _saving ? null : _save,
                  child: _saving
                      ? const SizedBox(width: AppSizes.spinnerSmall, height: AppSizes.spinnerSmall, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Guardar cambios'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Márgenes de «Próximo»: cuántos días o kilómetros antes se marca un mantenimiento como «Próximo». Los usan la lista
/// de Mantenimientos, el panel de control y los avisos.
class _MaintenanceCard extends StatefulWidget {
  const _MaintenanceCard({required this.settings});

  final AppSettings settings;

  @override
  State<_MaintenanceCard> createState() => _MaintenanceCardState();
}

class _MaintenanceCardState extends State<_MaintenanceCard> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _days = TextEditingController(text: '${widget.settings.maintenance.soonDays}');
  late final TextEditingController _km = TextEditingController(text: '${widget.settings.maintenance.soonKm}');

  bool _saving = false;
  String? _generalError;
  Map<String, String> _serverErrors = const {};

  @override
  void dispose() {
    _days.dispose();
    _km.dispose();
    super.dispose();
  }

  String? _validate(String? value, {required String label, required int min, required int max}) {
    final number = int.tryParse((value ?? '').trim());
    if (number == null || number < min || number > max) {
      return '$label debe ser un número entero entre ${formatQuantity(min)} y ${formatQuantity(max)}.';
    }
    return null;
  }

  Future<void> _save() async {
    setState(() {
      _generalError = null;
      _serverErrors = const {};
    });
    if (!_formKey.currentState!.validate()) {
      return;
    }
    setState(() => _saving = true);
    final provider = context.read<SettingsProvider>();
    try {
      await provider.saveMaintenance(soonDays: int.parse(_days.text.trim()), soonKm: int.parse(_km.text.trim()));
      if (!mounted) {
        return;
      }
      final saved = provider.settings!.maintenance;
      _days.text = '${saved.soonDays}';
      _km.text = '${saved.soonKm}';
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Márgenes guardados.')));
    } on ApiException catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _saving = false;
        _serverErrors = e.fieldErrors;
        _generalError = e.fieldErrors.isEmpty ? e.message : null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final settings = widget.settings;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Márgenes de «Próximo»', style: theme.textTheme.titleMedium),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Un mantenimiento se marca «Próximo» cuando faltan estos días o kilómetros, o menos. Los usan la lista de Mantenimientos, el panel de control y los avisos.',
                style: theme.textTheme.bodySmall,
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                sourceText(settings.maintenance.source, updatedByName: settings.updatedByName, updatedAt: settings.updatedAt),
                style: theme.textTheme.bodySmall,
              ),
              const SizedBox(height: AppSpacing.lg),
              TextFormField(
                controller: _days,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(labelText: 'Días de anticipación', errorText: _serverErrors['maintenance.soonDays']),
                validator: (value) => _validate(value, label: 'El margen en días', min: 1, max: 365),
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _km,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(labelText: 'Kilómetros de anticipación', errorText: _serverErrors['maintenance.soonKm']),
                validator: (value) => _validate(value, label: 'El margen en kilómetros', min: 100, max: 50000),
              ),
              if (_generalError != null) ...[
                const SizedBox(height: AppSpacing.md),
                Text(_generalError!, style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.danger)),
              ],
              const SizedBox(height: AppSpacing.lg),
              Align(
                alignment: Alignment.centerLeft,
                child: FilledButton(
                  onPressed: _saving ? null : _save,
                  child: _saving
                      ? const SizedBox(width: AppSizes.spinnerSmall, height: AppSizes.spinnerSmall, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Guardar márgenes'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Términos y condiciones: versión vigente y quién la aceptó. Es solo de lectura; las versiones nuevas las publica quien
/// administra el servidor con un script (no hay edición desde la aplicación).
class _TermsCard extends StatelessWidget {
  const _TermsCard();

  @override
  Widget build(BuildContext context) {
    final terms = context.watch<TermsProvider>();
    final theme = Theme.of(context);
    final current = terms.current;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Términos y condiciones', style: theme.textTheme.titleMedium),
            const SizedBox(height: AppSpacing.xs),
            Text(
              current == null
                  ? (terms.loading ? 'Cargando…' : 'Todavía no se ha publicado ninguna versión.')
                  : 'Versión vigente: ${current.version}, publicada el ${formatDate(current.publishedAt)}.',
              style: theme.textTheme.bodySmall,
            ),
            const SizedBox(height: AppSpacing.lg),
            Text('Aceptaciones', style: theme.textTheme.titleSmall),
            const SizedBox(height: AppSpacing.sm),
            _acceptances(context, terms),
          ],
        ),
      ),
    );
  }

  Widget _acceptances(BuildContext context, TermsProvider terms) {
    if (terms.acceptancesLoading && terms.acceptances.isEmpty) {
      return const SizedBox(height: 120, child: LoadingState());
    }
    if (terms.acceptancesError != null) {
      return SizedBox(
        height: 220,
        child: ErrorState(message: terms.acceptancesError!, onRetry: () => context.read<TermsProvider>().loadAcceptances()),
      );
    }
    if (terms.acceptances.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
        child: Text('Nadie ha aceptado los términos todavía.', style: Theme.of(context).textTheme.bodyMedium),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: DataTable(
            columns: const [
              DataColumn(label: Text('Usuario')),
              DataColumn(label: Text('Nombre')),
              DataColumn(label: Text('Versión')),
              DataColumn(label: Text('Fecha de aceptación')),
            ],
            rows: [
              for (final row in terms.acceptances)
                DataRow(
                  cells: [
                    DataCell(Text(row.username)),
                    DataCell(Text(row.userName)),
                    DataCell(Text('${row.version}')),
                    DataCell(Text(formatDateTime(row.acceptedAt))),
                  ],
                ),
            ],
          ),
        ),
        const Divider(),
        TableFooter(
          page: terms.acceptancesPage,
          pageSize: TermsProvider.acceptancesPageSize,
          total: terms.acceptancesTotal,
          onPageChanged: (page) => context.read<TermsProvider>().goToAcceptancesPage(page),
        ),
      ],
    );
  }
}

/// Catálogo de tipos de servicio con su intervalo. El administrador agrega, edita y desactiva; nunca se borra un tipo.
class _ServiceTypesCard extends StatelessWidget {
  const _ServiceTypesCard();

  Future<void> _openDialog(BuildContext context, {ServiceType? type}) async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => _ServiceTypeDialog(type: type),
    );
    if (saved == true && context.mounted) {
      showFeedback(context, 'Tipo de servicio guardado.');
    }
  }

  Future<void> _toggle(BuildContext context, ServiceType type) async {
    final provider = context.read<ServiceTypesProvider>();
    if (type.active) {
      final confirmed = await showConfirmDialog(
        context,
        message:
            '¿Seguro que quieres desactivar el tipo «${type.name}»? Ya no se podrá elegir en órdenes nuevas, pero las líneas que ya lo usan lo conservan.',
      );
      if (!confirmed || !context.mounted) {
        return;
      }
    }
    try {
      await provider.setActive(type.id, !type.active);
      if (context.mounted) {
        showFeedback(context, type.active ? 'Tipo de servicio desactivado.' : 'Tipo de servicio reactivado.');
      }
    } on ApiException catch (e) {
      if (context.mounted) {
        showFeedback(context, e.message, error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final types = context.watch<ServiceTypesProvider>();
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(child: Text('Tipos de servicio', style: theme.textTheme.titleMedium)),
                OutlinedButton(onPressed: () => _openDialog(context), child: const Text('Agregar tipo')),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Cada tipo indica cada cuánto se repite el servicio. Al registrar el próximo mantenimiento de una orden se propone a partir de él.',
              style: theme.textTheme.bodySmall,
            ),
            const SizedBox(height: AppSpacing.lg),
            _body(context, types),
          ],
        ),
      ),
    );
  }

  Widget _body(BuildContext context, ServiceTypesProvider types) {
    if (types.loading && types.items.isEmpty) {
      return const SizedBox(height: 120, child: LoadingState());
    }
    if (types.error != null && types.items.isEmpty) {
      return SizedBox(
        height: 220,
        child: ErrorState(message: types.error!, onRetry: () => context.read<ServiceTypesProvider>().load()),
      );
    }
    if (types.items.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
        child: Text(
          'Todavía no hay tipos de servicio. Agrega el primero para proponer los próximos mantenimientos.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      );
    }
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: DataTable(
        columns: const [
          DataColumn(label: Text('Nombre')),
          DataColumn(label: Text('Cada (días)')),
          DataColumn(label: Text('Cada (km)')),
          DataColumn(label: Text('Estado')),
          DataColumn(label: Text('Acciones')),
        ],
        rows: [
          for (final type in types.items)
            DataRow(
              cells: [
                DataCell(Text(type.name)),
                DataCell(Text(type.daysText)),
                DataCell(Text(type.kmText)),
                DataCell(StatusChip(active: type.active)),
                DataCell(
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        tooltip: 'Editar ${type.name}',
                        onPressed: () => _openDialog(context, type: type),
                        icon: const Icon(LucideIcons.pencil, size: AppSizes.icon),
                      ),
                      IconButton(
                        tooltip: type.active ? 'Desactivar ${type.name}' : 'Reactivar ${type.name}',
                        onPressed: () => _toggle(context, type),
                        icon: Icon(type.active ? LucideIcons.ban : LucideIcons.rotateCcw, size: AppSizes.icon),
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

/// Alta o edición de un tipo de servicio. Los errores del servidor (nombre repetido) se muestran bajo el campo sin cerrar.
class _ServiceTypeDialog extends StatefulWidget {
  const _ServiceTypeDialog({this.type});

  final ServiceType? type;

  @override
  State<_ServiceTypeDialog> createState() => _ServiceTypeDialogState();
}

class _ServiceTypeDialogState extends State<_ServiceTypeDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name = TextEditingController(text: widget.type?.name ?? '');
  late final TextEditingController _days = TextEditingController(text: widget.type?.intervalDays?.toString() ?? '');
  late final TextEditingController _km = TextEditingController(text: widget.type?.intervalKm?.toString() ?? '');

  bool _saving = false;
  String? _intervalError;
  String? _generalError;
  Map<String, String> _serverErrors = const {};

  @override
  void dispose() {
    _name.dispose();
    _days.dispose();
    _km.dispose();
    super.dispose();
  }

  String? _validateInterval(String? value, {required String label, required int max}) {
    final text = (value ?? '').trim();
    if (text.isEmpty) {
      return null;
    }
    final number = int.tryParse(text);
    if (number == null || number < 1 || number > max) {
      return '$label deben ser un entero entre 1 y ${formatQuantity(max)}.';
    }
    return null;
  }

  Future<void> _save() async {
    setState(() {
      _generalError = null;
      _serverErrors = const {};
    });
    final valid = _formKey.currentState!.validate();
    final hasInterval = _days.text.trim().isNotEmpty || _km.text.trim().isNotEmpty;
    setState(() => _intervalError = hasInterval ? null : 'Indica al menos un intervalo: en días, en kilómetros o en ambos.');
    if (!valid || !hasInterval) {
      return;
    }
    setState(() => _saving = true);
    final provider = context.read<ServiceTypesProvider>();
    final days = _days.text.trim().isEmpty ? null : int.parse(_days.text.trim());
    final km = _km.text.trim().isEmpty ? null : int.parse(_km.text.trim());
    try {
      if (widget.type == null) {
        await provider.create(name: _name.text.trim(), intervalDays: days, intervalKm: km);
      } else {
        await provider.update(widget.type!.id, name: _name.text.trim(), intervalDays: days, intervalKm: km);
      }
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } on ApiException catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _saving = false;
        _serverErrors = {
          ...e.fieldErrors,
          if (e.code == 'SERVICE_TYPE_DUPLICATE') 'name': e.message,
        };
        _generalError = _serverErrors.isEmpty ? e.message : null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AlertDialog(
      title: Text(widget.type == null ? 'Agregar tipo de servicio' : 'Editar tipo de servicio'),
      content: SizedBox(
        width: AppSizes.dialogWidth,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextFormField(
                  controller: _name,
                  autofocus: true,
                  enabled: !_saving,
                  decoration: InputDecoration(labelText: 'Nombre', errorText: _serverErrors['name']),
                  validator: (value) {
                    final text = (value ?? '').trim();
                    if (text.isEmpty) {
                      return 'El nombre es obligatorio.';
                    }
                    return text.length > 80 ? 'El nombre no puede tener más de 80 caracteres.' : null;
                  },
                ),
                const SizedBox(height: AppSpacing.lg),
                TextFormField(
                  controller: _days,
                  enabled: !_saving,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(labelText: 'Intervalo en días (opcional)', errorText: _serverErrors['intervalDays']),
                  validator: (value) => _validateInterval(value, label: 'Los días', max: 3650),
                ),
                const SizedBox(height: AppSpacing.lg),
                TextFormField(
                  controller: _km,
                  enabled: !_saving,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(labelText: 'Intervalo en kilómetros (opcional)', errorText: _serverErrors['intervalKm']),
                  validator: (value) => _validateInterval(value, label: 'Los kilómetros', max: 500000),
                ),
                if (_intervalError != null)
                  Padding(
                    padding: const EdgeInsets.only(top: AppSpacing.sm),
                    child: Text(_intervalError!, style: theme.textTheme.bodySmall?.copyWith(color: AppColors.danger)),
                  ),
                if (_generalError != null)
                  Padding(
                    padding: const EdgeInsets.only(top: AppSpacing.md),
                    child: Text(_generalError!, style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.danger)),
                  ),
              ],
            ),
          ),
        ),
      ),
      actions: [
        OutlinedButton(onPressed: _saving ? null : () => Navigator.of(context).pop(false), child: const Text('Cancelar')),
        FilledButton(onPressed: _saving ? null : _save, child: const Text('Guardar')),
      ],
    );
  }
}
