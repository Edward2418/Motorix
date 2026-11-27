import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/terms.dart';
import '../providers/terms_provider.dart';
import '../utils/app_tokens.dart';
import '../utils/formatters.dart';
import 'view_states.dart';

/// Texto desplazable de una versión: los términos y, debajo, el aviso de privacidad. Lo usan la pantalla de aceptación y
/// la vista de consulta, para que ambas muestren siempre lo mismo.
class TermsText extends StatelessWidget {
  const TermsText({super.key, required this.terms});

  final TermsInfo terms;

  // Una línea como «3. Finalidades» es el título de una sección.
  static final _heading = RegExp(r'^\d+\.\s+\S');

  List<Widget> _sections(String text, ThemeData theme) {
    final widgets = <Widget>[];
    final paragraph = <String>[];
    void flush() {
      if (paragraph.isNotEmpty) {
        widgets.add(Text(paragraph.join('\n'), style: theme.textTheme.bodyMedium));
        paragraph.clear();
      }
    }

    for (final line in text.split('\n')) {
      if (line.trim().isEmpty) {
        flush();
        widgets.add(const SizedBox(height: AppSpacing.md));
      } else if (_heading.hasMatch(line)) {
        flush();
        widgets
          ..add(Text(line.trim(), style: theme.textTheme.titleSmall))
          ..add(const SizedBox(height: AppSpacing.xs));
      } else {
        paragraph.add(line.trim());
      }
    }
    flush();
    return widgets;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    // `primary: true` comparte el controlador entre la barra y el desplazamiento.
    return Scrollbar(
      child: SingleChildScrollView(
        primary: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ..._sections(terms.termsText, theme),
            const SizedBox(height: AppSpacing.xl),
            Text('Aviso de privacidad', style: theme.textTheme.titleMedium),
            const SizedBox(height: AppSpacing.sm),
            ..._sections(terms.privacyText, theme),
          ],
        ),
      ),
    );
  }
}

/// Abre la consulta de solo lectura de los términos y el aviso de privacidad vigentes. Con [public] funciona sin sesión
/// (pantalla de inicio). No cambia la aceptación: eso ocurre únicamente en la pantalla obligatoria tras iniciar sesión.
Future<void> showTermsDialog(BuildContext context, {bool public = false}) =>
    showDialog<void>(context: context, builder: (_) => _TermsDialog(public: public));

class _TermsDialog extends StatefulWidget {
  const _TermsDialog({required this.public});

  final bool public;

  @override
  State<_TermsDialog> createState() => _TermsDialogState();
}

class _TermsDialogState extends State<_TermsDialog> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  void _load() {
    if (mounted) {
      context.read<TermsProvider>().load(public: widget.public);
    }
  }

  @override
  Widget build(BuildContext context) {
    final terms = context.watch<TermsProvider>();
    final current = terms.current;
    return AlertDialog(
      title: const Text('Términos y aviso de privacidad'),
      content: SizedBox(
        width: 640,
        height: 480,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (current != null) ...[
              Text(
                'Versión ${current.version}, publicada el ${formatDate(current.publishedAt)}.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: AppSpacing.md),
            ],
            Expanded(child: _body(terms)),
          ],
        ),
      ),
      actions: [FilledButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cerrar'))],
    );
  }

  Widget _body(TermsProvider terms) {
    if (terms.loading && terms.current == null) {
      return const LoadingState();
    }
    if (terms.error != null && terms.current == null) {
      return ErrorState(message: terms.error!, onRetry: _load);
    }
    final current = terms.current;
    if (current == null) {
      return const EmptyState(message: 'Todavía no se ha publicado ninguna versión.');
    }
    return TermsText(terms: current);
  }
}
