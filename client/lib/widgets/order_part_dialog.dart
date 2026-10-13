import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/part.dart';
import '../models/service_order.dart';
import '../providers/parts_provider.dart';
import '../services/api_client.dart';
import '../utils/app_tokens.dart';
import '../utils/formatters.dart';

const int _maxQuantity = 99999;

/// Refacción elegida con su cantidad y el motivo (solo cuando la administración modifica una orden terminada).
typedef PartChoice = ({Part part, int quantity, String? reason});

/// Nueva cantidad de una línea y el motivo opcional.
typedef QuantityChange = ({int quantity, String? reason});

/// Agrega una refacción a la orden: busca entre las activas, muestra existencia y precio, y pide la cantidad.
/// [requireReason] es verdadero cuando la administración modifica una orden TERMINADA.
Future<PartChoice?> showAddPartDialog(BuildContext context, {required bool requireReason}) {
  return showDialog<PartChoice>(
    context: context,
    builder: (_) => _OrderPartDialog(requireReason: requireReason),
  );
}

/// Cambia la cantidad de una refacción que ya está en la orden.
Future<QuantityChange?> showPartQuantityDialog(
  BuildContext context, {
  required OrderPartLine line,
  required bool requireReason,
}) {
  return showDialog<QuantityChange>(
    context: context,
    builder: (_) => _OrderPartDialog(line: line, requireReason: requireReason),
  );
}

/// Pide solo el motivo (por ejemplo, al quitar una refacción de una orden terminada). Devuelve `null` si se cancela.
Future<String?> showPartReasonDialog(BuildContext context, {required String title, required String message}) {
  return showDialog<String>(
    context: context,
    builder: (_) => _ReasonDialog(title: title, message: message),
  );
}

String? _validateReason(String? value, {required bool required}) {
  final text = value?.trim() ?? '';
  if (text.isEmpty) {
    return required ? 'Indica el motivo del cambio.' : null;
  }
  return text.length > 255 ? 'El motivo no puede tener más de 255 caracteres.' : null;
}

class _OrderPartDialog extends StatefulWidget {
  const _OrderPartDialog({this.line, required this.requireReason});

  /// Línea que se edita; `null` al agregar una refacción nueva.
  final OrderPartLine? line;
  final bool requireReason;

  @override
  State<_OrderPartDialog> createState() => _OrderPartDialogState();
}

class _OrderPartDialogState extends State<_OrderPartDialog> {
  final _formKey = GlobalKey<FormState>();
  final _search = TextEditingController();
  late final _quantity = TextEditingController(text: widget.line == null ? '' : '${widget.line!.quantity}');
  final _reason = TextEditingController();

  Timer? _debounce;
  List<Part> _results = const [];
  Part? _selected;
  bool _searching = false;
  String? _searchError;

  bool get _editing => widget.line != null;

  @override
  void initState() {
    super.initState();
    if (!_editing) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _runSearch(''));
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    _quantity.dispose();
    _reason.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () => _runSearch(value));
  }

  Future<void> _runSearch(String text) async {
    setState(() {
      _searching = true;
      _searchError = null;
    });
    try {
      final parts = await context.read<PartsProvider>().searchActive(text);
      if (mounted) {
        setState(() => _results = parts);
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _results = const [];
          _searchError = e.message;
        });
      }
    } finally {
      if (mounted) {
        setState(() => _searching = false);
      }
    }
  }

  /// Existencia máxima que puede pedir el usuario: al editar, lo ya reservado más el stock libre se valida en el servidor.
  String? _validateQuantity(String? value) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) {
      return 'Indica la cantidad.';
    }
    final number = int.tryParse(text);
    if (number == null || number < 1 || number > _maxQuantity) {
      return 'La cantidad debe ser un entero entre 1 y $_maxQuantity.';
    }
    final part = _selected;
    if (part != null && number > part.stock) {
      return 'Solo hay ${formatQuantity(part.stock)} ${part.stock == 1 ? 'unidad disponible' : 'unidades disponibles'}.';
    }
    return null;
  }

  void _confirm() {
    if (!_editing && _selected == null) {
      setState(() => _searchError = 'Elige la refacción que se usó.');
      return;
    }
    if (!_formKey.currentState!.validate()) {
      return;
    }
    final quantity = int.parse(_quantity.text.trim());
    final reason = _reason.text.trim().isEmpty ? null : _reason.text.trim();
    if (_editing) {
      Navigator.of(context).pop<QuantityChange>((quantity: quantity, reason: reason));
    } else {
      Navigator.of(context).pop<PartChoice>((part: _selected!, quantity: quantity, reason: reason));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AlertDialog(
      title: Text(_editing ? 'Cambiar cantidad' : 'Agregar refacción'),
      content: SizedBox(
        width: AppSizes.dialogWidth + AppSizes.cellWide,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_editing)
                  Text('${widget.line!.name} (${widget.line!.code})', style: theme.textTheme.bodyLarge)
                else ...[
                  TextField(
                    controller: _search,
                    autofocus: true,
                    onChanged: _onSearchChanged,
                    decoration: const InputDecoration(labelText: 'Buscar refacción por código, nombre o marca'),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxHeight: AppSizes.optionsMaxHeight),
                    child: _buildResults(theme),
                  ),
                  if (_searchError != null)
                    Padding(
                      padding: const EdgeInsets.only(top: AppSpacing.sm),
                      child: Text(_searchError!, style: theme.textTheme.bodySmall?.copyWith(color: AppColors.danger)),
                    ),
                ],
                const SizedBox(height: AppSpacing.lg),
                TextFormField(
                  controller: _quantity,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: 'Cantidad',
                    helperText: _selected == null ? null : 'Disponible: ${formatQuantity(_selected!.stock)}',
                  ),
                  validator: _validateQuantity,
                ),
                if (widget.requireReason) ...[
                  const SizedBox(height: AppSpacing.lg),
                  TextFormField(
                    controller: _reason,
                    minLines: 2,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Motivo del cambio (obligatorio en órdenes terminadas)',
                      alignLabelWithHint: true,
                    ),
                    validator: (value) => _validateReason(value, required: true),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
      actions: [
        OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
        FilledButton(onPressed: _confirm, child: Text(_editing ? 'Guardar cantidad' : 'Agregar')),
      ],
    );
  }

  Widget _buildResults(ThemeData theme) {
    if (_searching && _results.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(AppSpacing.lg),
        child: Center(child: SizedBox(width: AppSizes.spinnerSmall, height: AppSizes.spinnerSmall, child: CircularProgressIndicator(strokeWidth: 2))),
      );
    }
    if (_results.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Text('No se encontraron refacciones activas.', style: theme.textTheme.bodyMedium),
      );
    }
    return ListView(
      shrinkWrap: true,
      children: [
        for (final part in _results)
          ListTile(
            dense: true,
            selected: _selected?.id == part.id,
            enabled: part.stock > 0,
            title: Text('${part.code} · ${part.name}'),
            subtitle: Text(
              part.stock > 0
                  ? 'Disponible: ${formatQuantity(part.stock)} · ${formatMoney(part.salePrice)}'
                  : 'Agotada',
            ),
            onTap: () => setState(() {
              _selected = part;
              _searchError = null;
            }),
          ),
      ],
    );
  }
}

class _ReasonDialog extends StatefulWidget {
  const _ReasonDialog({required this.title, required this.message});

  final String title;
  final String message;

  @override
  State<_ReasonDialog> createState() => _ReasonDialogState();
}

class _ReasonDialogState extends State<_ReasonDialog> {
  final _formKey = GlobalKey<FormState>();
  final _reason = TextEditingController();

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: SizedBox(
        width: AppSizes.dialogWidth,
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(widget.message),
              const SizedBox(height: AppSpacing.lg),
              TextFormField(
                controller: _reason,
                autofocus: true,
                minLines: 2,
                maxLines: 4,
                decoration: const InputDecoration(labelText: 'Motivo del cambio', alignLabelWithHint: true),
                validator: (value) => _validateReason(value, required: true),
              ),
            ],
          ),
        ),
      ),
      actions: [
        OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
        FilledButton(
          onPressed: () {
            if (_formKey.currentState!.validate()) {
              Navigator.of(context).pop(_reason.text.trim());
            }
          },
          child: const Text('Confirmar'),
        ),
      ],
    );
  }
}
