import 'maintenance.dart';
import 'part.dart';
import 'service_order.dart';

/// Orden mostrada en una lista de atención del panel.
class DashboardOrder {
  const DashboardOrder({
    required this.id,
    required this.folio,
    required this.clientName,
    required this.vehicleLabel,
    required this.status,
    required this.total,
    required this.balance,
    this.finishedAt,
  });

  final int id;
  final String folio;
  final String clientName;
  final String vehicleLabel;
  final OrderStatus status;
  final double total;
  final double balance;
  final DateTime? finishedAt;

  factory DashboardOrder.fromJson(Map<String, dynamic> json) => DashboardOrder(
        id: json['id'] as int,
        folio: json['folio'] as String,
        clientName: (json['clientName'] ?? '') as String,
        vehicleLabel: (json['vehicleLabel'] ?? '') as String,
        status: OrderStatus.fromApi(json['status'] as String),
        total: ((json['total'] ?? 0) as num).toDouble(),
        balance: ((json['balance'] ?? 0) as num).toDouble(),
        finishedAt: json['finishedAt'] == null ? null : DateTime.parse(json['finishedAt'] as String).toLocal(),
      );
}

class DashboardAppointment {
  const DashboardAppointment({
    required this.id,
    required this.scheduledAt,
    required this.clientName,
    required this.vehicleLabel,
    required this.status,
  });

  final int id;
  final DateTime scheduledAt;
  final String clientName;
  final String vehicleLabel;
  final String status;

  factory DashboardAppointment.fromJson(Map<String, dynamic> json) => DashboardAppointment(
        id: json['id'] as int,
        scheduledAt: DateTime.parse(json['scheduledAt'] as String).toLocal(),
        clientName: (json['clientName'] ?? '') as String,
        vehicleLabel: (json['vehicleLabel'] ?? '') as String,
        status: (json['status'] ?? '') as String,
      );
}

class DashboardMaintenance {
  const DashboardMaintenance({
    required this.id,
    required this.description,
    required this.vehicleLabel,
    required this.clientName,
    required this.visualStatus,
  });

  final int id;
  final String description;
  final String vehicleLabel;
  final String clientName;
  final MaintenanceVisualStatus visualStatus;

  factory DashboardMaintenance.fromJson(Map<String, dynamic> json) => DashboardMaintenance(
        id: json['id'] as int,
        description: json['description'] as String,
        vehicleLabel: (json['vehicleLabel'] ?? '') as String,
        clientName: (json['clientName'] ?? '') as String,
        visualStatus: MaintenanceVisualStatus.fromApi(json['visualStatus'] as String),
      );
}

class DashboardPart {
  const DashboardPart({
    required this.id,
    required this.code,
    required this.name,
    required this.stock,
    required this.minStock,
    required this.stockLevel,
  });

  final int id;
  final String code;
  final String name;
  final int stock;
  final int minStock;
  final StockLevel stockLevel;

  factory DashboardPart.fromJson(Map<String, dynamic> json) => DashboardPart(
        id: json['id'] as int,
        code: json['code'] as String,
        name: json['name'] as String,
        stock: json['stock'] as int,
        minStock: json['minStock'] as int,
        stockLevel: StockLevel.fromApi(json['stockLevel'] as String),
      );
}

/// Cantidad de órdenes en un estado (para la gráfica).
class StatusCount {
  const StatusCount({required this.status, required this.count});

  final OrderStatus status;
  final int count;

  factory StatusCount.fromJson(Map<String, dynamic> json) =>
      StatusCount(status: OrderStatus.fromApi(json['status'] as String), count: json['count'] as int);
}

/// Panel de control: indicadores principales, órdenes por estado y listas de atención.
class Dashboard {
  const Dashboard({
    required this.periodKey,
    required this.from,
    required this.to,
    required this.vehiclesInRepair,
    required this.openOrders,
    required this.collected,
    required this.lowStockParts,
    required this.ordersByStatus,
    this.finishedCount = 0,
    this.finishedOrders = const [],
    this.upcomingCount = 0,
    this.upcomingAppointments = const [],
    this.maintenanceOverdue = 0,
    this.maintenanceSoon = 0,
    this.maintenanceItems = const [],
    this.lowStockItems = const [],
    this.pendingBalanceTotal = 0,
    this.pendingBalanceCount = 0,
    this.pendingBalanceOrders = const [],
  });

  final String periodKey;
  final DateTime from;
  final DateTime to;
  final int vehiclesInRepair;
  final int openOrders;
  final double collected;
  final int lowStockParts;
  final List<StatusCount> ordersByStatus;
  final int finishedCount;
  final List<DashboardOrder> finishedOrders;
  final int upcomingCount;
  final List<DashboardAppointment> upcomingAppointments;
  final int maintenanceOverdue;
  final int maintenanceSoon;
  final List<DashboardMaintenance> maintenanceItems;
  final List<DashboardPart> lowStockItems;
  final double pendingBalanceTotal;
  final int pendingBalanceCount;
  final List<DashboardOrder> pendingBalanceOrders;

  /// Total de órdenes de la gráfica.
  int get totalOrders => ordersByStatus.fold(0, (sum, item) => sum + item.count);

  factory Dashboard.fromJson(Map<String, dynamic> json) {
    final period = json['period'] as Map<String, dynamic>;
    final indicators = json['indicators'] as Map<String, dynamic>;
    final attention = (json['attention'] as Map<String, dynamic>?) ?? const {};
    Map<String, dynamic> section(String key) => (attention[key] as Map<String, dynamic>?) ?? const {};
    List<T> items<T>(Map<String, dynamic> data, T Function(Map<String, dynamic>) parse) => [
          for (final item in (data['items'] as List<dynamic>? ?? const [])) parse(item as Map<String, dynamic>),
        ];
    final finished = section('finishedOrders');
    final upcoming = section('upcomingAppointments');
    final maintenance = section('maintenance');
    final lowStock = section('lowStockParts');
    final pending = section('pendingBalance');
    return Dashboard(
      periodKey: period['key'] as String,
      from: DateTime.parse(period['from'] as String).toLocal(),
      to: DateTime.parse(period['to'] as String).toLocal(),
      vehiclesInRepair: indicators['vehiclesInRepair'] as int,
      openOrders: indicators['openOrders'] as int,
      collected: (indicators['collected'] as num).toDouble(),
      lowStockParts: indicators['lowStockParts'] as int,
      ordersByStatus: [
        for (final item in (json['ordersByStatus'] as List<dynamic>? ?? const []))
          StatusCount.fromJson(item as Map<String, dynamic>),
      ],
      finishedCount: (finished['count'] ?? 0) as int,
      finishedOrders: items(finished, DashboardOrder.fromJson),
      upcomingCount: (upcoming['count'] ?? 0) as int,
      upcomingAppointments: items(upcoming, DashboardAppointment.fromJson),
      maintenanceOverdue: (maintenance['overdue'] ?? 0) as int,
      maintenanceSoon: (maintenance['soon'] ?? 0) as int,
      maintenanceItems: items(maintenance, DashboardMaintenance.fromJson),
      lowStockItems: items(lowStock, DashboardPart.fromJson),
      pendingBalanceTotal: ((pending['total'] ?? 0) as num).toDouble(),
      pendingBalanceCount: (pending['count'] ?? 0) as int,
      pendingBalanceOrders: items(pending, DashboardOrder.fromJson),
    );
  }
}
