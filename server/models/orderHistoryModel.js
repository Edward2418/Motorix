import { query } from '../config/db.js';

// Historial de cambios de estado de las órdenes. Solo se insertan y consultan filas: nunca se editan ni se borran.

export async function insert({ orderId, fromStatus, toStatus, changedBy, reason = null }, conn) {
  await query(
    'INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, reason) VALUES (?, ?, ?, ?, ?)',
    [orderId, fromStatus, toStatus, changedBy, reason],
    conn
  );
}

export async function listByOrder(orderId, conn) {
  const rows = await query(
    `SELECT h.from_status, h.to_status, u.name AS changed_by, h.reason, h.changed_at
     FROM order_status_history h
     JOIN users u ON u.id = h.changed_by
     WHERE h.order_id = ?
     ORDER BY h.changed_at, h.id`,
    [orderId],
    conn
  );
  return rows.map((row) => ({
    fromStatus: row.from_status,
    toStatus: row.to_status,
    changedBy: row.changed_by,
    reason: row.reason,
    changedAt: row.changed_at
  }));
}
