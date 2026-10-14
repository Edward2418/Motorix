import * as dashboardModel from '../models/dashboardModel.js';
import * as partModel from '../models/partModel.js';
import { resolvePeriod, upcomingRange } from './dashboardPeriods.js';
import { listMaintenance } from './maintenanceService.js';
import { ORDER_STATUSES } from './orderStateMachine.js';

const LIST_SIZE = 5;

// Mantenimientos pendientes por estado visual. El total sale de `total` del listado (que ya clasifica con los umbrales).
async function maintenanceAttention(now) {
  const page = (visualStatus) => listMaintenance({ status: 'PROGRAMADO', visualStatus, page: 1, pageSize: LIST_SIZE }, { now });
  const [overdue, soon] = await Promise.all([page('VENCIDO'), page('PROXIMO')]);
  const items = [...overdue.data, ...soon.data].slice(0, LIST_SIZE).map((item) => ({
    id: item.id,
    description: item.description,
    vehicleLabel: item.vehicleLabel,
    clientName: item.clientName,
    visualStatus: item.visualStatus
  }));
  return { overdue: overdue.total, soon: soon.total, items };
}

/**
 * Panel de control: cuatro indicadores, órdenes por estado y listas de atención. Todo se calcula al consultar con la
 * información real; no se guardan copias. `period` (today, week o month) aplica al importe cobrado y a las órdenes
 * terminadas; lo demás es el estado actual.
 */
export async function getDashboard(periodKey, now = new Date()) {
  const period = resolvePeriod(periodKey, now);
  const upcoming = upcomingRange(now);
  const [byStatus, collected, alerts, finished, appointments, maintenance, balances] = await Promise.all([
    dashboardModel.countByStatus(),
    dashboardModel.sumCollected(period),
    partModel.listAlerts().then((rows) => rows.map((row) => partModel.toPart(row, { includePurchasePrice: false }))),
    dashboardModel.finishedOrders({ ...period, limit: LIST_SIZE }),
    dashboardModel.upcomingAppointments({ ...upcoming, limit: LIST_SIZE }),
    maintenanceAttention(now),
    dashboardModel.pendingBalances({ limit: LIST_SIZE })
  ]);
  const openOrders = ORDER_STATUSES.filter((status) => status !== 'ENTREGADO' && status !== 'CANCELADA').reduce(
    (sum, status) => sum + (byStatus[status] ?? 0),
    0
  );
  return {
    period: { key: period.key, from: period.from.toISOString(), to: period.to.toISOString() },
    indicators: {
      vehiclesInRepair: byStatus.EN_REPARACION ?? 0,
      openOrders,
      collected,
      lowStockParts: alerts.length
    },
    ordersByStatus: ORDER_STATUSES.map((status) => ({ status, count: byStatus[status] ?? 0 })),
    attention: {
      finishedOrders: finished,
      upcomingAppointments: appointments,
      maintenance,
      lowStockParts: {
        count: alerts.length,
        items: alerts.slice(0, LIST_SIZE).map((part) => ({
          id: part.id,
          code: part.code,
          name: part.name,
          stock: part.stock,
          minStock: part.minStock,
          stockLevel: part.stockLevel
        }))
      },
      pendingBalance: balances
    }
  };
}
