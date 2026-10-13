import 'package:flutter/material.dart';

import '../models/appointment.dart';
import '../models/maintenance.dart';
import '../models/part.dart';
import '../models/service_order.dart';
import '../utils/app_tokens.dart';

/// Insignia discreta con el color del estado (docs/design-system.md §5).
class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.label, required this.color});

  /// Insignia de una orden de servicio.
  factory StatusBadge.order(OrderStatus status, {Key? key}) =>
      StatusBadge(key: key, label: status.label, color: orderStatusColor(status));

  /// Insignia de una cita.
  factory StatusBadge.appointment(AppointmentStatus status, {Key? key}) =>
      StatusBadge(key: key, label: status.label, color: appointmentStatusColor(status));

  /// Insignia del estado visual de un mantenimiento (Normal, Próximo o Vencido).
  factory StatusBadge.maintenance(MaintenanceVisualStatus status, {Key? key}) =>
      StatusBadge(key: key, label: status.label, color: maintenanceStatusColor(status));

  /// Insignia del nivel de stock de una refacción (Normal, Bajo o Agotado).
  factory StatusBadge.stock(StockLevel level, {Key? key}) =>
      StatusBadge(key: key, label: level.label, color: stockLevelColor(level));

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: AppDurations.state,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        border: Border.all(color: color.withValues(alpha: 0.4)),
        borderRadius: BorderRadius.circular(AppRadius.panel),
      ),
      child: Text(label, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: color)),
    );
  }
}

/// Recibido gris; Diagnóstico y Esperando refacción `warning`; En reparación `primary`;
/// Terminado y Entregado `success`; Cancelada `danger`.
Color orderStatusColor(OrderStatus status) => switch (status) {
      OrderStatus.received => AppColors.textSecondary,
      OrderStatus.diagnosis => AppColors.warning,
      OrderStatus.inRepair => AppColors.primary,
      OrderStatus.waitingPart => AppColors.warning,
      OrderStatus.finished => AppColors.success,
      OrderStatus.delivered => AppColors.success,
      OrderStatus.cancelled => AppColors.danger,
    };

Color appointmentStatusColor(AppointmentStatus status) => switch (status) {
      AppointmentStatus.pending => AppColors.textSecondary,
      AppointmentStatus.confirmed => AppColors.primary,
      AppointmentStatus.inProgress => AppColors.warning,
      AppointmentStatus.completed => AppColors.success,
      AppointmentStatus.cancelled => AppColors.danger,
    };

/// Normal gris, Próximo `warning`, Vencido `danger` (docs/design-system.md).
Color maintenanceStatusColor(MaintenanceVisualStatus status) => switch (status) {
      MaintenanceVisualStatus.normal => AppColors.textSecondary,
      MaintenanceVisualStatus.soon => AppColors.warning,
      MaintenanceVisualStatus.overdue => AppColors.danger,
    };

/// Normal `success`, Bajo `warning`, Agotado `danger`.
Color stockLevelColor(StockLevel level) => switch (level) {
      StockLevel.normal => AppColors.success,
      StockLevel.low => AppColors.warning,
      StockLevel.outOfStock => AppColors.danger,
    };
