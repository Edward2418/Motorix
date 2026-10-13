import { query } from '../config/db.js';
import { likePattern } from '../validators/common.js';

const ORDER_SELECT = `
  SELECT o.id, o.folio, o.status, o.client_id, c.name AS client_name, o.vehicle_id,
         CONCAT(v.license_plate, ' · ', v.brand, ' ', v.model, ' ', v.year) AS vehicle_label,
         o.mechanic_id, m.name AS mechanic_name, o.entry_mileage, o.previous_mileage,
         o.mileage_correction_reason, o.service_mileage, o.service_mileage_correction_reason, o.appointment_id, o.reported_problem, o.diagnosis, o.notes,
         o.recommendations, o.cancel_reason, o.delivered_at, o.created_at, o.updated_at,
         (SELECT COALESCE(SUM(s.cost), 0) FROM order_services s WHERE s.order_id = o.id) AS services_total,
         (SELECT COALESCE(SUM(l.amount), 0) FROM order_labor l WHERE l.order_id = o.id) AS labor_total,
         (SELECT COALESCE(SUM(p.quantity * p.unit_price), 0) FROM order_parts p WHERE p.order_id = o.id) AS parts_total
  FROM service_orders o
  JOIN clients c ON c.id = o.client_id
  JOIN vehicles v ON v.id = o.vehicle_id
  JOIN users m ON m.id = o.mechanic_id`;

const money = (value) => Math.round(Number(value) * 100) / 100;

// Convierte una fila SQL en el objeto de la API (camelCase). El total se calcula, nunca se almacena.
export function toOrder(row) {
  if (!row) {
    return null;
  }
  const servicesTotal = money(row.services_total);
  const laborTotal = money(row.labor_total);
  const partsTotal = money(row.parts_total);
  return {
    id: row.id,
    folio: row.folio,
    status: row.status,
    clientId: row.client_id,
    clientName: row.client_name,
    vehicleId: row.vehicle_id,
    vehicleLabel: row.vehicle_label,
    mechanicId: row.mechanic_id,
    mechanicName: row.mechanic_name,
    entryMileage: row.entry_mileage,
    previousMileage: row.previous_mileage,
    mileageCorrectionReason: row.mileage_correction_reason,
    serviceMileage: row.service_mileage,
    serviceMileageCorrectionReason: row.service_mileage_correction_reason,
    appointmentId: row.appointment_id,
    reportedProblem: row.reported_problem,
    diagnosis: row.diagnosis,
    notes: row.notes,
    recommendations: row.recommendations,
    cancelReason: row.cancel_reason,
    deliveredAt: row.delivered_at,
    servicesTotal,
    laborTotal,
    partsTotal,
    total: money(servicesTotal + laborTotal + partsTotal),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Resumen para los listados: sin el contenido técnico de la orden.
export function toSummary(order) {
  return {
    id: order.id,
    folio: order.folio,
    status: order.status,
    clientId: order.clientId,
    clientName: order.clientName,
    vehicleId: order.vehicleId,
    vehicleLabel: order.vehicleLabel,
    mechanicId: order.mechanicId,
    mechanicName: order.mechanicName,
    entryMileage: order.entryMileage,
    total: order.total,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
}

export async function findById(id, conn) {
  const rows = await query(`${ORDER_SELECT} WHERE o.id = ? LIMIT 1`, [id], conn);
  return toOrder(rows[0]);
}

// Bloquea la orden dentro de una transacción antes de cambiarla.
export async function lockById(id, conn) {
  const rows = await query(
    'SELECT id, folio, status, mechanic_id, appointment_id, vehicle_id, entry_mileage FROM service_orders WHERE id = ? FOR UPDATE',
    [id],
    conn
  );
  return rows[0] ?? null;
}

// Orden abierta (ni ENTREGADO ni CANCELADA) de un vehículo, si existe.
export async function findOpenByVehicle(vehicleId, conn) {
  const rows = await query(
    "SELECT id, folio FROM service_orders WHERE vehicle_id = ? AND status NOT IN ('ENTREGADO','CANCELADA') LIMIT 1",
    [vehicleId],
    conn
  );
  return rows[0] ?? null;
}

export async function insert(data, conn) {
  const result = await query(
    `INSERT INTO service_orders
       (folio, client_id, vehicle_id, mechanic_id, appointment_id, entry_mileage, previous_mileage,
        mileage_correction_reason, reported_problem, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.folio,
      data.clientId,
      data.vehicleId,
      data.mechanicId,
      data.appointmentId,
      data.entryMileage,
      data.previousMileage,
      data.mileageCorrectionReason,
      data.reportedProblem,
      data.createdBy
    ],
    conn
  );
  return result.insertId;
}

export async function updateMechanic(id, mechanicId, conn) {
  await query('UPDATE service_orders SET mechanic_id = ? WHERE id = ?', [mechanicId, id], conn);
}

// Órdenes abiertas asignadas a un mecánico (para impedir su baja o el cambio de rol).
export async function listOpenByMechanic(mechanicId) {
  return query(
    "SELECT id, folio FROM service_orders WHERE mechanic_id = ? AND status NOT IN ('ENTREGADO','CANCELADA') ORDER BY id",
    [mechanicId]
  );
}

// Listado paginado, de la más reciente a la más antigua. El mecánico siempre se filtra en el servicio.
export async function list({ status, mechanicId, clientId, search, page, pageSize }) {
  const conditions = [];
  const params = [];
  if (status) {
    conditions.push('o.status = ?');
    params.push(status);
  }
  if (mechanicId) {
    conditions.push('o.mechanic_id = ?');
    params.push(mechanicId);
  }
  if (clientId) {
    conditions.push('o.client_id = ?');
    params.push(clientId);
  }
  if (search) {
    const pattern = likePattern(search);
    conditions.push('(o.folio LIKE ? OR v.license_plate LIKE ? OR c.name LIKE ?)');
    params.push(pattern, pattern, pattern);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [{ total }] = await query(
    `SELECT COUNT(*) AS total
     FROM service_orders o
     JOIN clients c ON c.id = o.client_id
     JOIN vehicles v ON v.id = o.vehicle_id
     ${where}`,
    params
  );
  const rows = await query(`${ORDER_SELECT} ${where} ORDER BY o.created_at DESC, o.id DESC LIMIT ? OFFSET ?`, [
    ...params,
    pageSize,
    (page - 1) * pageSize
  ]);
  return { items: rows.map(toOrder), total: Number(total) };
}

// Cambia el estado solo si la orden sigue en `fromStatus` (bloqueo optimista). Devuelve true si se aplicó.
export async function updateStatus(
  id,
  fromStatus,
  toStatus,
  { cancelReason = null, deliveredAt = null, serviceMileage = null } = {},
  conn
) {
  const result = await query(
    `UPDATE service_orders
     SET status = ?, cancel_reason = COALESCE(?, cancel_reason), delivered_at = COALESCE(?, delivered_at),
         service_mileage = COALESCE(?, service_mileage)
     WHERE id = ? AND status = ?`,
    [toStatus, cancelReason, deliveredAt, serviceMileage, id, fromStatus],
    conn
  );
  return result.affectedRows === 1;
}

// Corrige el kilometraje del servicio de una orden finalizada y deja el motivo y quién lo corrigió.
export async function setServiceMileage(id, mileage, { reason, correctedBy }, conn) {
  await query(
    `UPDATE service_orders
     SET service_mileage = ?, service_mileage_correction_reason = ?, service_mileage_corrected_by = ?
     WHERE id = ?`,
    [mileage, reason, correctedBy, id],
    conn
  );
}

// Campos de contenido editables y su columna. Solo se actualizan los que vienen en `fields`.
const CONTENT_COLUMNS = Object.freeze({
  reportedProblem: 'reported_problem',
  diagnosis: 'diagnosis',
  notes: 'notes',
  recommendations: 'recommendations'
});

export async function updateContent(id, fields, conn) {
  const keys = Object.keys(fields).filter((key) => CONTENT_COLUMNS[key]);
  if (keys.length === 0) {
    return;
  }
  const assignments = keys.map((key) => `${CONTENT_COLUMNS[key]} = ?`).join(', ');
  await query(`UPDATE service_orders SET ${assignments} WHERE id = ?`, [...keys.map((key) => fields[key]), id], conn);
}
