import { env } from '../config/env.js';
import { withTransaction } from '../config/db.js';
import * as maintenanceModel from '../models/maintenanceModel.js';
import * as orderModel from '../models/orderModel.js';
import * as vehicleModel from '../models/vehicleModel.js';
import { AppError } from '../utils/AppError.js';
import { classifyMaintenance, compareUrgency } from './maintenanceStatus.js';

// Próximos mantenimientos de un vehículo: programarlos desde una orden, atenderlos, cancelarlos y consultarlos.
// El estado visual (Normal, Próximo, Vencido) se calcula al consultar; nunca se almacena.

const formatKm = (km) => Number(km).toLocaleString('en-US');

// Fecha local de hoy en formato AAAA-MM-DD.
export function todayLocal(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function fieldError(field, message) {
  return AppError.validation(message, [{ field, message }]);
}

// Agrega el estado visual y los restantes. Solo los PROGRAMADO tienen estado visual.
export function withVisualStatus(maintenance, { now = new Date(), thresholds = env.maintenance } = {}) {
  if (maintenance.status !== 'PROGRAMADO') {
    return { ...maintenance, visualStatus: null, remainingDays: null, remainingKm: null };
  }
  const { visualStatus, remainingDays, remainingKm } = classifyMaintenance({
    dueDate: maintenance.dueDate,
    dueMileage: maintenance.dueMileage,
    currentMileage: maintenance.currentMileage,
    today: todayLocal(now),
    soonDays: thresholds.soonDays,
    soonKm: thresholds.soonKm
  });
  return { ...maintenance, visualStatus, remainingDays, remainingKm };
}

export async function listByOrder(orderId, conn) {
  return (await maintenanceModel.listByOrder(orderId, conn)).map((item) => withVisualStatus(item));
}

// Programa el próximo mantenimiento desde una orden. Orden de comprobaciones: la orden existe (404), el rol y la
// propiedad (403), la orden no está cancelada y el vehículo está activo (409) y, por último, la fecha y el
// kilometraje objetivo (400).
export async function createMaintenance(orderId, input, actor, { now = new Date() } = {}) {
  const id = await withTransaction(async (conn) => {
    const order = await orderModel.lockById(orderId, conn);
    if (!order) {
      throw AppError.notFound('La orden no existe.');
    }
    if (actor.role === 'MECHANIC' && order.mechanic_id !== actor.id) {
      throw AppError.forbidden('Solo el mecánico asignado puede programar mantenimientos desde esta orden.');
    }
    if (order.status === 'CANCELADA') {
      throw AppError.conflict('La orden está cancelada: no se pueden programar mantenimientos desde ella.');
    }
    const vehicle = await vehicleModel.findById(order.vehicle_id);
    if (!vehicle.active) {
      throw AppError.conflict('El vehículo está desactivado: no se pueden programar mantenimientos para él.');
    }
    if (input.dueDate !== null && input.dueDate < todayLocal(now)) {
      throw fieldError('dueDate', 'La fecha del mantenimiento no puede ser anterior a hoy.');
    }
    if (input.dueMileage !== null && input.dueMileage <= vehicle.currentMileage) {
      throw fieldError(
        'dueMileage',
        `El kilometraje objetivo debe ser mayor al actual del vehículo (${formatKm(vehicle.currentMileage)} km).`
      );
    }
    try {
      return await maintenanceModel.insert(
        { ...input, vehicleId: order.vehicle_id, orderId, createdBy: actor.id },
        conn
      );
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        const existing = await maintenanceModel.findPendingByVehicleAndDescription(order.vehicle_id, input.description);
        throw AppError.duplicateMaintenance(existing?.id ?? '—');
      }
      throw error;
    }
  });
  return withVisualStatus(await maintenanceModel.findById(id), { now });
}

// Cierra un mantenimiento pendiente (atendido o cancelado). Administración y recepción cierran cualquiera; el
// mecánico solo los de sus órdenes de origen. El cambio es condicional: si otro usuario lo cerró antes, responde 409.
async function closePending(id, actor, close) {
  await withTransaction(async (conn) => {
    const locked = await maintenanceModel.lockById(id, conn);
    if (!locked) {
      throw AppError.notFound('El mantenimiento no existe.');
    }
    if (actor.role === 'MECHANIC' && locked.mechanic_id !== actor.id) {
      throw AppError.forbidden('Solo el mecánico de la orden de origen puede cerrar este mantenimiento.');
    }
    if (locked.status !== 'PROGRAMADO') {
      throw AppError.conflict(`El mantenimiento ya está ${locked.status.toLowerCase()} y no puede cambiar.`);
    }
    await close(locked, conn);
  });
  return withVisualStatus(await maintenanceModel.findById(id));
}

export async function fulfillMaintenance(id, { orderId }, actor) {
  return closePending(id, actor, async (locked, conn) => {
    if (orderId !== null) {
      const order = await orderModel.findById(orderId, conn);
      if (!order || order.vehicleId !== locked.vehicle_id) {
        throw fieldError('orderId', 'La orden indicada no existe o no es de este vehículo.');
      }
    }
    if (!(await maintenanceModel.markFulfilled(id, { orderId, closedBy: actor.id }, conn))) {
      throw AppError.conflict('El mantenimiento cambió mientras se procesaba tu solicitud. Vuelve a intentarlo.');
    }
  });
}

export async function cancelMaintenance(id, { reason }, actor) {
  return closePending(id, actor, async (_locked, conn) => {
    if (!(await maintenanceModel.markCancelled(id, { reason, closedBy: actor.id }, conn))) {
      throw AppError.conflict('El mantenimiento cambió mientras se procesaba tu solicitud. Vuelve a intentarlo.');
    }
  });
}

// Consulta con estado visual: clasifica, filtra por estado visual, ordena por urgencia y pagina en memoria.
export async function listMaintenance(filters, { now = new Date(), thresholds = env.maintenance } = {}) {
  const { visualStatus, page, pageSize, ...rest } = filters;
  const items = (await maintenanceModel.listWithContext(rest)).map((item) => withVisualStatus(item, { now, thresholds }));
  const filtered = visualStatus ? items.filter((item) => item.visualStatus === visualStatus) : items;
  // Los pendientes se ordenan por urgencia; los ya cerrados, del más reciente al más antiguo.
  const ordered =
    rest.status === 'PROGRAMADO'
      ? [...filtered].sort(compareUrgency)
      : [...filtered].sort((a, b) => new Date(b.closedAt ?? b.createdAt) - new Date(a.closedAt ?? a.createdAt) || b.id - a.id);
  const start = (page - 1) * pageSize;
  return { data: ordered.slice(start, start + pageSize), page, pageSize, total: ordered.length };
}
