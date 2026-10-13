import 'package:flutter/material.dart';

import '../models/client.dart';
import '../services/api_client.dart';
import '../utils/app_tokens.dart';

/// Campo para elegir un cliente activo con búsqueda por nombre. Exige elegir una opción de la lista.
/// Si [locked] es verdadero solo muestra el nombre (por ejemplo, cuando el cliente viene de una cita).
class ClientPickerField extends StatefulWidget {
  const ClientPickerField({
    super.key,
    required this.controller,
    required this.search,
    required this.selected,
    required this.onSelected,
    required this.onCleared,
    this.label = 'Cliente',
    this.emptyError = 'Elige un cliente de la lista.',
    this.locked = false,
    this.enabled = true,
    this.serverError,
  });

  final TextEditingController controller;

  /// Consulta los clientes activos que coinciden con el texto escrito.
  final Future<List<Client>> Function(String text) search;
  final Client? selected;
  final ValueChanged<Client> onSelected;
  final VoidCallback onCleared;
  final String label;
  final String emptyError;
  final bool locked;
  final bool enabled;
  final String? serverError;

  @override
  State<ClientPickerField> createState() => _ClientPickerFieldState();
}

class _ClientPickerFieldState extends State<ClientPickerField> {
  final _focusNode = FocusNode();

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.locked) {
      return TextFormField(
        controller: widget.controller,
        enabled: false,
        decoration: InputDecoration(labelText: widget.label),
      );
    }
    return RawAutocomplete<Client>(
      textEditingController: widget.controller,
      focusNode: _focusNode,
      displayStringForOption: (client) => client.name,
      optionsBuilder: (value) async {
        if (value.text.trim().length < 2) {
          return const Iterable<Client>.empty();
        }
        try {
          return await widget.search(value.text);
        } on ApiException {
          return const Iterable<Client>.empty();
        }
      },
      onSelected: widget.onSelected,
      fieldViewBuilder: (context, textController, focusNode, onFieldSubmitted) => TextFormField(
        controller: textController,
        focusNode: focusNode,
        enabled: widget.enabled,
        onChanged: (value) {
          if (widget.selected != null && value != widget.selected!.name) {
            widget.onCleared();
          }
        },
        decoration: InputDecoration(
          labelText: widget.label,
          helperText: 'Escribe al menos 2 letras del nombre y elige un cliente de la lista.',
          errorText: widget.serverError,
        ),
        validator: (_) => widget.selected == null ? widget.emptyError : null,
      ),
      optionsViewBuilder: (context, onSelected, options) => Align(
        alignment: Alignment.topLeft,
        child: Material(
          color: AppColors.surface,
          elevation: 2,
          borderRadius: BorderRadius.circular(AppRadius.panel),
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              maxWidth: AppSizes.formMaxWidth - 2 * AppSpacing.xl,
              maxHeight: AppSizes.optionsMaxHeight,
            ),
            child: ListView(
              padding: EdgeInsets.zero,
              shrinkWrap: true,
              children: [
                for (final client in options)
                  ListTile(
                    dense: true,
                    title: Text(client.name),
                    subtitle: Text(client.phone),
                    onTap: () => onSelected(client),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
