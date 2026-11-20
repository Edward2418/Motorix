import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/app_settings.dart';
import '../providers/settings_provider.dart';
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
        height: 160,
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
