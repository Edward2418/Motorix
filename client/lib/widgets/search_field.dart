import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../utils/app_tokens.dart';

/// Campo de búsqueda que espera un instante tras cada pulsación antes de consultar.
class SearchField extends StatefulWidget {
  const SearchField({super.key, required this.hint, required this.onChanged});

  final String hint;
  final ValueChanged<String> onChanged;

  @override
  State<SearchField> createState() => _SearchFieldState();
}

class _SearchFieldState extends State<SearchField> {
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () => widget.onChanged(value));
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      onChanged: _onChanged,
      decoration: InputDecoration(
        hintText: widget.hint,
        prefixIcon: const Icon(LucideIcons.search, size: AppSizes.icon),
        isDense: true,
      ),
    );
  }
}
