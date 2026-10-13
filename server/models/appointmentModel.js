import { query } from '../config/db.js';

const APPOINTMENT_SELECT = `
  SELECT a.id, a.client_id, c.name AS client_name, a.vehicle_id,
         CONCAT(v.license_plate, ' · ', v.brand, ' ', v.model, ' ', v.year) AS vehicle_label,
         a.scheduled_at, a.reason, a.notes, a.status, a.cancel_reason, a.created_at, a.updated_at,
         o.id AS order_id, o.folio AS order_folio
  FROM appointments a
  JOIN clients c ON c.id = a.client_id
  JOIN vehicles v ON v.id = a.vehicle_id
  LEFT JOIN service_orders o ON o.appointment_id = a.id`;

// Convierte una fila SQL en el objeto público de la API (camelCase).
export function toAppointment(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    vehicleId: row.vehicle_id,
    vehicleLabel: row.vehicle_label,
    scheduledAt: row.scheduled_at,
    reason: row.reason,
    notes: row.notes,
    status: row.status,
    cancelReason: row.cancel_reason,
    orderId: row.order_id ?? null,
    orderFolio: row.order_folio ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function findById(id, conn) {
  const rows = await query(`${APPOINTMENT_SELECT} WHERE a.id = ? LIMIT 1`, [id], conn);
  return toAppointment(rows[0]);
}

// Bloquea la cita (dentro de una transacción) para cambiarla sin carreras.
export async function lockById(id, conn) {
  const rows = await query('SELECT id, status, client_id, vehicle_id FROM appointments WHERE id = ? FOR UPDATE', [id], conn);
  return rows[0] ?? null;
}

// Listado paginado, ordenado por fecha y hora. `from` y `to` son fechas AAAA-MM-DD (ambas inclusive).
export async function list({ from, to, status, clientId, page, pageSize }) {
  const conditions = [];
  const params = [];
  if (from) {
    conditions.push('a.scheduled_at >= ?');
    params.push(`${from} 00:00:00`);
  }
  if (to) {
    conditions.push('a.scheduled_at <= ?');
    params.push(`${to} 23:59:59`);
  }
  if (status) {
    conditions.push('a.status = ?');
    params.push(status);
  }
  if (clientId) {
    conditions.push('a.client_id = ?');
    params.push(clientId);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM appointments a ${where}`, params);
  const rows = await query(`${APPOINTMENT_SELECT} ${where} ORDER BY a.scheduled_at, a.id LIMIT ? OFFSET ?`, [
    ...params,
    pageSize,
    (page - 1) * pageSize
  ]);
  return { items: rows.map(toAppointment), total: Number(total) };
}

export async function create({ clientId, vehicleId, scheduledAt, reason, notes, createdBy }) {
  const result = await query(
    'INSERT INTO appointments (client_id, vehicle_id, scheduled_at, reason, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)',
    [clientId, vehicleId, scheduledAt, reason, notes, createdBy]
  );
  return findById(result.insertId);
}

export async function update(id, { scheduledAt, reason, notes }) {
  await query('UPDATE appointments SET scheduled_at = ?, reason = ?, notes = ? WHERE id = ?', [
    scheduledAt,
    reason,
    notes,
    id
  ]);
  return findById(id);
}

// Cambia el estado de la cita. `cancelReason` solo se guarda al cancelar. Acepta una conexión de transacción.
export async function updateStatus(id, status, cancelReason = null, conn) {
  await query('UPDATE appointments SET status = ?, cancel_reason = ? WHERE id = ?', [status, cancelReason, id], conn);
}

// Otra cita activa (no cancelada) del mismo vehículo a la misma hora.
export async function findActiveByVehicleAt(vehicleId, scheduledAt, excludeId = 0) {
  const rows = await query(
    `SELECT id FROM appointments
     WHERE vehicle_id = ? AND scheduled_at = ? AND status <> 'CANCELADA' AND id <> ? LIMIT 1`,
    [vehicleId, scheduledAt, excludeId]
  );
  return rows[0] ?? null;
}
