import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/part.dart';
import '../providers/parts_provider.dart';
import '../services/api_client.dart';
import '../utils/app_tokens.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/section_navigator.dart';

const int _maxStock = 99999999;
const double _maxPrice = 99999999.99;

/// Formulario de alta y edición de una refacción. El stock inicial solo se captura en el alta: después
/// el stock cambia únicamente con movimientos de inventario. Al guardar cierra devolviendo `true`.
class PartFormScreen extends StatefulWidget {
  const PartFormScreen({super.key, this.part});

  /// Refacción que se edita; `null` para registrar una nueva.
  final Part? part;

  @override
  State<PartFormScreen> createState() => _PartFormScreenState();
}

class _PartFormScreenState extends State<PartFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final _code = TextEditingController(text: widget.part?.code ?? '');
  late final _name = TextEditingController(text: widget.part?.name ?? '');
  late final _category = TextEditingController(text: widget.part?.category ?? '');
  late final _brand = TextEditingController(text: widget.part?.brand ?? '');
  late final _initialStock = TextEditingController();
  late final _minStock = TextEditingController(text: widget.part == null ? '' : '${widget.part!.minStock}');
  late final _purchasePrice = TextEditingController(text: widget.part?.purchasePrice?.toStringAsFixed(2) ?? '');
  late final _salePrice = TextEditingController(text: widget.part?.salePrice.toStringAsFixed(2) ?? '');

  bool _saving = false;
  bool _saved = false;
  String? _generalError;
  Map<String, String> _serverErrors = const {};

  bool get _editing => widget.part != null;

  List<TextEditingController> get _controllers =>
      [_code, _name, _category, _brand, _initialStock, _minStock, _purchasePrice, _salePrice];

  /// Hay cambios sin guardar: en el alta, cualquier campo con texto; en la edición, algún valor distinto.
  bool get _dirty {
    if (_saved) {
      return false;
    }
    final part = widget.part;
    if (part == null) {
      return _controllers.any((controller) => controller.text.isNotEmpty);
    }
    return _code.text.trim() != part.code ||
        _name.text.trim() != part.name ||
        _category.text.trim() != part.category ||
        _brand.text.trim() != part.brand ||
        _minStock.text.trim() != '${part.minStock}' ||
        _purchasePrice.text.trim() != (part.purchasePrice?.toStringAsFixed(2) ?? '') ||
        _salePrice.text.trim() != part.salePrice.toStringAsFixed(2);
  }

  @override
  void dispose() {
    for (final controller in _controllers) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _confirmExit() async {
    final leave = await showConfirmDialog(
      context,
      message: '¿Seguro que quieres salir? Los cambios sin guardar se perderán.',
    );
    if (leave && mounted) {
      Navigator.of(context).pop();
    }
  }

  Future<void> _submit() async {
    setState(() {
      _generalError = null;
      _serverErrors = const {};
    });
    if (!_formKey.currentState!.validate()) {
      return;
    }
    setState(() => _saving = true);
    try {
      final parts = context.read<PartsProvider>();
      final minStock = int.parse(_minStock.text.trim());
      final purchasePrice = double.parse(_purchasePrice.text.trim());
      final salePrice = double.parse(_salePrice.text.trim());
      if (_editing) {
        await parts.update(
          widget.part!.id,
          code: _code.text.trim(),
          name: _name.text.trim(),
          category: _category.text.trim(),
          brand: _brand.text.trim(),
          minStock: minStock,
          purchasePrice: purchasePrice,
          salePrice: salePrice,
        );
      } else {
        await parts.create(
          code: _code.text.trim(),
          name: _name.text.trim(),
          category: _category.text.trim(),
          brand: _brand.text.trim(),
          initialStock: _initialStock.text.trim().isEmpty ? 0 : int.parse(_initialStock.text.trim()),
          minStock: minStock,
          purchasePrice: purchasePrice,
          salePrice: salePrice,
        );
      }
      if (!mounted) {
        return;
      }
      _saved = true;
      Navigator.of(context).pop(true);
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

  String? _requiredText(String? value, String label, {required String adjective, required int max}) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) {
      return '$label es $adjective.';
    }
    return text.length > max ? '$label no puede tener más de $max caracteres.' : null;
  }

  String? _quantity(String? value, String label, {required bool optional}) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) {
      return optional ? null : '$label es obligatorio.';
    }
    final number = int.tryParse(text);
    if (number == null || number < 0 || number > _maxStock) {
      return 'Escribe un número entero entre 0 y $_maxStock.';
    }
    return null;
  }

  String? _price(String? value, String label) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) {
      return '$label es obligatorio.';
    }
    final number = double.tryParse(text);
    if (number == null || number < 0 || number > _maxPrice) {
      return 'Escribe un importe válido entre 0 y 99,999,999.99.';
    }
    return RegExp(r'^\d+(\.\d{1,2})?$').hasMatch(text) ? null : 'El importe admite como máximo dos decimales.';
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      // La decisión se toma al intentar salir, porque los campos cambian sin reconstruir el widget.
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) {
          return;
        }
        if (_dirty) {
          _confirmExit();
        } else {
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(_editing ? 'Editar refacción' : 'Registrar refacción'),
          backgroundColor: AppColors.surface,
          scrolledUnderElevation: 0,
        ),
        body: PagePadding(
          child: SingleChildScrollView(
            child: Align(
              alignment: Alignment.topLeft,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: AppSizes.formMaxWidth),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpacing.xl),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: TextFormField(
                                  controller: _code,
                                  enabled: !_saving,
                                  textCapitalization: TextCapitalization.characters,
                                  decoration: InputDecoration(labelText: 'Código', errorText: _serverErrors['code']),
                                  validator: (value) => _requiredText(value, 'El código', adjective: 'obligatorio', max: 40),
                                ),
                              ),
                              const SizedBox(width: AppSpacing.lg),
                              Expanded(
                                flex: 2,
                                child: TextFormField(
                                  controller: _name,
                                  enabled: !_saving,
                                  decoration: InputDecoration(labelText: 'Nombre', errorText: _serverErrors['name']),
                                  validator: (value) => _requiredText(value, 'El nombre', adjective: 'obligatorio', max: 120),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.lg),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: TextFormField(
                                  controller: _category,
                                  enabled: !_saving,
                                  decoration: InputDecoration(labelText: 'Categoría', errorText: _serverErrors['category']),
                                  validator: (value) => _requiredText(value, 'La categoría', adjective: 'obligatoria', max: 60),
                                ),
                              ),
                              const SizedBox(width: AppSpacing.lg),
                              Expanded(
                                child: TextFormField(
                                  controller: _brand,
                                  enabled: !_saving,
                                  decoration: InputDecoration(labelText: 'Marca', errorText: _serverErrors['brand']),
                                  validator: (value) => _requiredText(value, 'La marca', adjective: 'obligatoria', max: 60),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.lg),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (!_editing) ...[
                                Expanded(
                                  child: TextFormField(
                                    controller: _initialStock,
                                    enabled: !_saving,
                                    keyboardType: TextInputType.number,
                                    decoration: InputDecoration(
                                      labelText: 'Stock inicial (opcional)',
                                      errorText: _serverErrors['initialStock'],
                                    ),
                                    validator: (value) => _quantity(value, 'El stock inicial', optional: true),
                                  ),
                                ),
                                const SizedBox(width: AppSpacing.lg),
                              ],
                              Expanded(
                                child: TextFormField(
                                  controller: _minStock,
                                  enabled: !_saving,
                                  keyboardType: TextInputType.number,
                                  decoration: InputDecoration(labelText: 'Stock mínimo', errorText: _serverErrors['minStock']),
                                  validator: (value) => _quantity(value, 'El stock mínimo', optional: false),
                                ),
                              ),
                            ],
                          ),
                          if (_editing) ...[
                            const SizedBox(height: AppSpacing.sm),
                            Text(
                              'Stock actual: ${widget.part!.stock}. Para cambiarlo registra una entrada o un ajuste.',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                          const SizedBox(height: AppSpacing.lg),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: TextFormField(
                                  controller: _purchasePrice,
                                  enabled: !_saving,
                                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                  decoration: InputDecoration(
                                    labelText: 'Precio de compra',
                                    errorText: _serverErrors['purchasePrice'],
                                  ),
                                  validator: (value) => _price(value, 'El precio de compra'),
                                ),
                              ),
                              const SizedBox(width: AppSpacing.lg),
                              Expanded(
                                child: TextFormField(
                                  controller: _salePrice,
                                  enabled: !_saving,
                                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                  decoration: InputDecoration(
                                    labelText: 'Precio de venta',
                                    errorText: _serverErrors['salePrice'],
                                  ),
                                  validator: (value) => _price(value, 'El precio de venta'),
                                ),
                              ),
                            ],
                          ),
                          if (_generalError != null) ...[
                            const SizedBox(height: AppSpacing.lg),
                            Text(_generalError!, style: const TextStyle(color: AppColors.danger)),
                          ],
                          const SizedBox(height: AppSpacing.xl),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              OutlinedButton(
                                onPressed: _saving ? null : () => Navigator.of(context).maybePop(),
                                child: const Text('Cancelar'),
                              ),
                              const SizedBox(width: AppSpacing.md),
                              FilledButton(
                                onPressed: _saving ? null : _submit,
                                child: Text(_saving ? 'Guardando…' : (_editing ? 'Guardar cambios' : 'Guardar refacción')),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
