import * as clientNoticeModel from '../models/clientNoticeModel.js';
import { AppError } from '../utils/AppError.js';
import { tomorrowRange } from './dashboardPeriods.js';
import { listAttentionMaintenance } from './maintenanceService.js';
import { parseKey } from './notificationRules.js';

// Clientes por avisar (Sprint 6): hechos vigentes que recepción debe comunicar al cliente. Se calculan al consultar con
// los mismos datos y criterios del centro de notificaciones; solo se guarda que ya se avisó (`client_notices`).

const NO_PHONE = 'Sin teléfono';
const phoneOf = (phone) => (typeof phone === 'string' && phone.trim() !== '' ? phone : NO_PHONE);
const iso = (value) => (value ? new Date(value).toISOString() : null);

// Orden en la lista: lo más urgente primero.
const REASON_ORDER = ['MANTENIMIENTO_VENCIDO', 'ORDEN_TERMINADA', 'CITA_MANANA', 'MANTENIMIENTO_PROXIMO'];

// Cada motivo corresponde a un solo tipo de clave de hecho.
const REASON_PREFIX = Object.freeze({
  ORDEN_TERMINADA: 'ORDER',
  CITA_MANANA: 'APPT',
  MANTENIMIENTO_PROXIMO: 'MAINT',
  MANTENIMIENTO_VENCIDO: 'MAINT'
});
export const NOTICE_REASONS = Object.freeze(Object.keys(REASON_PREFIX));
export const reasonPrefix = (reason) => REASON_PREFIX[reason];

function orderFact(order) {
  return {
    reason: 'ORDEN_TERMINADA',
    factKey: `ORDER:${order.id}`,
    clientId: order.clientId,
    clientName: order.clientName,
    phone: phoneOf(order.phone),
    vehicleLabel: order.vehicleLabel,
    detail: `Orden ${order.folio} terminada sin entregar`,
    date: iso(order.date)
  };
}

function appointmentFact(appointment) {
  const hora = new Date(appointment.date);
  const text = `${String(hora.getHours()).padStart(2, '0')}:${String(hora.getMinutes()).padStart(2, '0')}`;
  return {
    reason: 'CITA_MANANA',
    factKey: `APPT:${appointment.id}`,
    clientId: appointment.clientId,
    clientName: appointment.clientName,
    phone: phoneOf(appointment.phone),
    vehicleLabel: appointment.vehicleLabel,
    detail: `Cita mañana a las ${text}`,
    date: iso(appointment.date)
  };
}

function maintenanceFact(item) {
  const overdue = item.visualStatus === 'VENCIDO';
  return {
    reason: overdue ? 'MANTENIMIENTO_VENCIDO' : 'MANTENIMIENTO_PROXIMO',
    factKey: `MAINT:${item.id}`,
    clientId: item.clientId,
    clientName: item.clientName,
    phone: phoneOf(item.clientPhone),
    vehicleLabel: item.vehicleLabel,
    detail: `${item.description} ${overdue ? 'vencido' : 'próximo'}`,
    date: item.dueDate ? iso(`${item.dueDate}T00:00:00`) : null
  };
}

// Todos los hechos vigentes (hayan sido avisados o no).
async function currentFacts(now) {
  const [orders, appointments, maintenance] = await Promise.all([
    clientNoticeModel.listFinishedOrders(),
    clientNoticeModel.listAppointmentsBetween(tomorrowRange(now)),
    listAttentionMaintenance({ now })
  ]);
  return [...orders.map(orderFact), ...appointments.map(appointmentFact), ...maintenance.map(maintenanceFact)];
}

/** Hechos vigentes que todavía no se avisaron, más urgentes primero. */
export async function listPending({ now = new Date() } = {}) {
  const [facts, ...noticed] = await Promise.all([
    currentFacts(now),
    ...NOTICE_REASONS.map((reason) => clientNoticeModel.listNoticedKeys(reason))
  ]);
  const noticedByReason = Object.fromEntries(NOTICE_REASONS.map((reason, index) => [reason, noticed[index]]));
  return facts
    .filter((fact) => !noticedByReason[fact.reason].has(fact.factKey))
    .sort((a, b) => REASON_ORDER.indexOf(a.reason) - REASON_ORDER.indexOf(b.reason));
}

/** El hecho vigente `(reason, factKey)` o `null` si ya no aplica (la orden se entregó, la cita se canceló, etc.). */
async function findCurrentFact(reason, factKey, now) {
  const { id } = parseKey(factKey);
  if (reason === 'ORDEN_TERMINADA') {
    const [order] = await clientNoticeModel.listFinishedOrders({ orderId: id });
    return order ? orderFact(order) : null;
  }
  if (reason === 'CITA_MANANA') {
    const [appointment] = await clientNoticeModel.listAppointmentsBetween({ ...tomorrowRange(now), appointmentId: id });
    return appointment ? appointmentFact(appointment) : null;
  }
  const item = (await listAttentionMaintenance({ now })).find((m) => m.id === id);
  const fact = item ? maintenanceFact(item) : null;
  return fact?.reason === reason ? fact : null;
}

/**
 * Registra que se avisó al cliente. Verifica que el hecho siga vigente (409 NOTICE_NOT_APPLICABLE si no) y usa el
 * cliente del propio hecho. Un hecho ya avisado responde 409 NOTICE_ALREADY_REGISTERED (restricción única).
 */
export async function register({ reason, factKey, note }, user, { now = new Date() } = {}) {
  const fact = await findCurrentFact(reason, factKey, now);
  if (!fact) {
    throw AppError.noticeNotApplicable();
  }
  return clientNoticeModel.insert({ clientId: fact.clientId, reason, factKey, note, notifiedBy: user.id });
}
