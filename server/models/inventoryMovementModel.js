import { query } from '../config/db.js';

// Movimientos de inventario. Solo se insertan y consultan filas: nunca se editan ni se borran.
// `quantity` lleva signo (ENTRADA > 0, SALIDA < 0, AJUSTE ≠ 0) y `stockAfter` guarda el stock resultante.

export function toMovement(row) {
  return {
    id: row.id,
    partId: row.part_id,
    type: row.type,
    quantity: row.quantity,
    stockAfter: row.stock_after,
    reason: row.reason,
    orderId: row.order_id,
    orderFolio: row.order_folio ?? null,
    createdByName: row.created_by_name ?? null,
    createdAt: row.created_at
  };
}

const MOVEMENT_SELECT = `
  SELECT m.id, m.part_id, m.type, m.quantity, m.stock_after, m.reason, m.order_id, m.created_at,
         o.folio AS order_folio, u.name AS created_by_name
  FROM inventory_movements m
  JOIN users u ON u.id = m.created_by
  LEFT JOIN service_orders o ON o.id = m.order_id`;

export async function insert({ partId, type, quantity, stockAfter, reason, orderId = null, createdBy }, conn) {
  const result = await query(
    `INSERT INTO inventory_movements (part_id, type, quantity, stock_after, reason, order_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [partId, type, quantity, stockAfter, reason, orderId, createdBy],
    conn
  );
  return result.insertId;
}

export async function findById(id, conn) {
  const rows = await query(`${MOVEMENT_SELECT} WHERE m.id = ? LIMIT 1`, [id], conn);
  return rows[0] ? toMovement(rows[0]) : null;
}

// Historial de una refacción, del más reciente al más antiguo.
export async function listByPart(partId, { page, pageSize }) {
  const [{ total }] = await query('SELECT COUNT(*) AS total FROM inventory_movements WHERE part_id = ?', [partId]);
  const rows = await query(`${MOVEMENT_SELECT} WHERE m.part_id = ? ORDER BY m.created_at DESC, m.id DESC LIMIT ? OFFSET ?`, [
    partId,
    pageSize,
    (page - 1) * pageSize
  ]);
  return { items: rows.map(toMovement), total: Number(total) };
}

// Suma de las cantidades con signo: debe coincidir siempre con `parts.stock`.
export async function sumByPart(partId, conn) {
  const [row] = await query('SELECT COALESCE(SUM(quantity), 0) AS total FROM inventory_movements WHERE part_id = ?', [partId], conn);
  return Number(row.total);
}
