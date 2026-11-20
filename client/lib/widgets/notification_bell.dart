import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/notification.dart';
import '../providers/navigation_provider.dart';
import '../providers/notifications_provider.dart';
import '../utils/app_tokens.dart';

/// Campana del encabezado con el total de avisos no leídos. Al tocarla abre el panel con los avisos agrupados por tipo
/// (docs/design-system.md). Sin avisos no muestra contador.
class NotificationBell extends StatelessWidget {
  const NotificationBell({super.key});

  Future<void> _open(BuildContext context) async {
    final provider = context.read<NotificationsProvider>();
    // El detalle se consulta al abrir el panel (no hay consulta periódica).
    provider.loadCenter();
    await showDialog<void>(
      context: context,
      barrierColor: Colors.transparent,
      builder: (_) => const _NotificationPanel(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final unread = context.watch<NotificationsProvider>().unread;
    return Tooltip(
      message: unread == 0 ? 'Avisos' : '$unread avisos sin leer',
      child: IconButton(
        onPressed: () => _open(context),
        icon: Stack(
          clipBehavior: Clip.none,
          children: [
            const Icon(LucideIcons.bell, color: AppColors.textSecondary),
            if (unread > 0)
              Positioned(
                top: -AppSpacing.sm,
                right: -AppSpacing.sm,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs + 1),
                  constraints: const BoxConstraints(minWidth: AppSpacing.lg),
                  decoration: BoxDecoration(color: AppColors.danger, borderRadius: BorderRadius.circular(AppRadius.pill)),
                  child: Text(
                    unread > 99 ? '99+' : '$unread',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(color: AppColors.onPrimary),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Panel flotante con los avisos. Muestra carga, vacío y error sin interrumpir el resto de la aplicación.
class _NotificationPanel extends StatelessWidget {
  const _NotificationPanel();

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<NotificationsProvider>();
    final center = provider.center;
    return Dialog(
      alignment: Alignment.topRight,
      insetPadding: const EdgeInsets.only(top: AppSizes.headerHeight, right: AppSpacing.xl),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: AppSizes.notificationPanelWidth, maxHeight: AppSizes.notificationPanelMaxHeight),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Avisos', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: AppSpacing.md),
              Flexible(child: _body(context, provider, center)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _body(BuildContext context, NotificationsProvider provider, NotificationCenter? center) {
    if (provider.loading && center == null) {
      return const Padding(
        padding: EdgeInsets.all(AppSpacing.xl),
        child: Center(
          child: SizedBox(width: AppSizes.spinner, height: AppSizes.spinner, child: CircularProgressIndicator(strokeWidth: 2)),
        ),
      );
    }
    if (provider.error != null && center == null) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(provider.error!, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.danger)),
          const SizedBox(height: AppSpacing.md),
          OutlinedButton(onPressed: provider.loadCenter, child: const Text('Reintentar')),
        ],
      );
    }
    if (center == null || center.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
        child: Text('No tienes avisos pendientes.', style: Theme.of(context).textTheme.bodyMedium),
      );
    }
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [for (final group in center.groups) _GroupSection(group: group)],
      ),
    );
  }
}

class _GroupSection extends StatelessWidget {
  const _GroupSection({required this.group});

  final NotificationGroup group;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${group.label} (${group.total})', style: theme.textTheme.titleSmall),
          const SizedBox(height: AppSpacing.xs),
          for (final item in group.items) _NotificationTile(item: item),
          if (group.hidden > 0) Text('y ${group.hidden} más', style: theme.textTheme.bodySmall),
        ],
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.item});

  final AppNotification item;

  Future<void> _open(BuildContext context) async {
    final provider = context.read<NotificationsProvider>();
    final navigation = context.read<NavigationProvider>();
    Navigator.of(context).pop();
    await provider.markRead(item.key);
    if (item.targetLabel.isNotEmpty) {
      navigation.select(item.targetLabel, orderId: item.targetOrderId);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = item.isGrave ? AppColors.danger : AppColors.warning;
    return InkWell(
      onTap: () => _open(context),
      borderRadius: BorderRadius.circular(AppRadius.control),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs + 2, horizontal: AppSpacing.xs),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.xs),
              child: Icon(item.read ? LucideIcons.check : LucideIcons.circle, size: AppSizes.spinnerSmall, color: item.read ? AppColors.textSecondary : color),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          item.title,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            fontWeight: item.read ? FontWeight.w400 : FontWeight.w600,
                            color: item.read ? AppColors.textSecondary : AppColors.textPrimary,
                          ),
                        ),
                      ),
                      // «Próximo» y «Vencido» llevan texto además de color (docs/design-system.md: no solo color).
                      if (item.statusLabel.isNotEmpty) ...[
                        const SizedBox(width: AppSpacing.sm),
                        Text(
                          item.statusLabel,
                          style: theme.textTheme.labelSmall?.copyWith(color: item.read ? AppColors.textSecondary : color, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ],
                  ),
                  Text(item.detail, style: theme.textTheme.bodySmall),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
