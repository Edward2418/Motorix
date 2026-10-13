import { query } from '../config/db.js';
import { likePattern } from '../validators/common.js';

// Mantenimientos programados. El estado visual (Normal, Próximo, Vencido) NO se guarda: lo calcula el servicio
// al consultar con maintenanceStatus.js. Nada se elimina; solo cambia el ciclo de vida.

// DATE_FORMAT evita que el controlador convierta la fecha a un objeto Date con zona horaria.
const MAINTENANCE_SELECT = `
  SELECT m.id, m.vehicle_id, CONCAT(v.license_plate, ' · ', v.brand, ' ', v.model, ' ', v.year) AS vehicle_label,
         v.current_mileage, v.client_id, c.name AS client_name, c.phone AS client_phone, v.active AS vehicle_active,
         m.order_id, o.folio AS order_folio, m.description, DATE_FORMAT(m.due_date, '%Y-%m-%d') AS due_date,
         m.due_mileage, m.notes, m.status, m.cancel_reason, m.fulfilled_order_id, m.closed_at, m.created_at
  FROM maintenance m
  JOIN vehicles v ON v.id = m.vehicle_id
  JOIN clients c ON c.id = v.client_id
  JOIN service_orders o ON o.id = m.order_id`;

export function toMaintenance(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    vehicleLabel: row.vehicle_label,
    currentMileage: row.current_mileage,
    clientId: row.client_id,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    orderId: row.order_id,
    orderFolio: row.order_folio,
    description: row.description,
    dueDate: row.due_date,
    dueMileage: row.due_mileage,
    notes: row.notes,
    status: row.status,
    cancelReason: row.cancel_reason,
    fulfilledOrderId: row.fulfilled_order_id,
    closedAt: row.closed_at,
    createdAt: row.created_at
  };
}

export async function findById(id, conn) {
  const rows = await query(`${MAINTENANCE_SELECT} WHERE m.id = ? LIMIT 1`, [id], conn);
  return toMaintenance(rows[0]);
}

// Bloquea solo la fila del mantenimiento (no la de la orden) y trae el mecánico de su orden de origen.
// Así no se invierte el orden de bloqueos con la cancelación de la orden, que bloquea la orden primero.
export async function lockById(id, conn) {
  const rows = await query(
    `SELECT m.id, m.vehicle_id, m.order_id, m.status, o.mechanic_id
     FROM maintenance m
     JOIN service_orders o ON o.id = m.order_id
     WHERE m.id = ?
     FOR UPDATE OF m`,
    [id],
    conn
  );
  return rows[0] ?? null;
}

export async function listByOrder(orderId, conn) {
  const rows = await query(`${MAINTENANCE_SELECT} WHERE m.order_id = ? ORDER BY m.id`, [orderId], conn);
  return rows.map(toMaintenance);
}

export async function findPendingByVehicleAndDescription(vehicleId, description, conn) {
  const rows = await query(
    "SELECT id FROM maintenance WHERE vehicle_id = ? AND description = ? AND status = 'PROGRAMADO' LIMIT 1",
    [vehicleId, description],
    conn
  );
  return rows[0] ?? null;
}

// Todos los que cumplen los filtros no calculados; el servicio clasifica, ordena y pagina (research.md §3).
// Los pendientes de un vehículo desactivado no se muestran.
export async function listWithContext({ status, clientId, vehicleId, q }) {
  const conditions = ['m.status = ?'];
  const params = [status];
  if (status === 'PROGRAMADO') {
    conditions.push('v.active = 1');
  }
  if (clientId) {
    conditions.push('v.client_id = ?');
    params.push(clientId);
  }
  if (vehicleId) {
    conditions.push('m.vehicle_id = ?');
    params.push(vehicleId);
  }
  if (q) {
    const pattern = likePattern(q);
    conditions.push('(v.license_plate LIKE ? OR m.description LIKE ? OR c.name LIKE ?)');
    params.push(pattern, pattern, pattern);
  }
  const rows = await query(`${MAINTENANCE_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY m.id`, params);
  return rows.map(toMaintenance);
}

export async function insert({ vehicleId, orderId, description, dueDate, dueMileage, notes, createdBy }, conn) {
  const result = await query(
    `INSERT INTO maintenance (vehicle_id, order_id, description, due_date, due_mileage, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [vehicleId, orderId, description, dueDate, dueMileage, notes, createdBy],
    conn
  );
  return result.insertId;
}

// Cambios de estado condicionales: solo se aplican si el mantenimiento sigue PROGRAMADO (devuelven si lo lograron).
export async function markFulfilled(id, { orderId, closedBy }, conn) {
  const result = await query(
    "UPDATE maintenance SET status = 'ATENDIDO', fulfilled_order_id = ?, closed_at = NOW(), closed_by = ? WHERE id = ? AND status = 'PROGRAMADO'",
    [orderId, closedBy, id],
    conn
  );
  return result.affectedRows === 1;
}

export async function markCancelled(id, { reason, closedBy }, conn) {
  const result = await query(
    "UPDATE maintenance SET status = 'CANCELADO', cancel_reason = ?, closed_at = NOW(), closed_by = ? WHERE id = ? AND status = 'PROGRAMADO'",
    [reason, closedBy, id],
    conn
  );
  return result.affectedRows === 1;
}

// Al cancelar una orden: sus mantenimientos pendientes pasan a CANCELADO (cierre automático, sin usuario).
export async function cancelPendingByOrder(orderId, reason, conn) {
  await query(
    "UPDATE maintenance SET status = 'CANCELADO', cancel_reason = ?, closed_at = NOW() WHERE order_id = ? AND status = 'PROGRAMADO'",
    [reason, orderId],
    conn
  );
}
