import { query } from '../config/db.js';

// Refacciones usadas en una orden: una línea por refacción, con la cantidad y el precio de venta copiado al agregarla.

const money = (value) => Math.round(Number(value) * 100) / 100;

function toLine(row) {
  return {
    id: row.id,
    partId: row.part_id,
    code: row.code,
    name: row.name,
    quantity: row.quantity,
    unitPrice: money(row.unit_price),
    subtotal: money(row.quantity * Number(row.unit_price))
  };
}

const LINE_SELECT = `
  SELECT op.id, op.order_id, op.part_id, p.code, p.name, op.quantity, op.unit_price
  FROM order_parts op
  JOIN parts p ON p.id = op.part_id`;

export async function listByOrder(orderId, conn) {
  const rows = await query(`${LINE_SELECT} WHERE op.order_id = ? ORDER BY op.id`, [orderId], conn);
  return rows.map(toLine);
}

// Línea de una orden concreta (null si no existe o pertenece a otra orden). Dentro de una transacción la bloquea.
export async function findLine(orderId, lineId, conn) {
  const rows = await query(
    `${LINE_SELECT} WHERE op.id = ? AND op.order_id = ? LIMIT 1${conn ? ' FOR UPDATE' : ''}`,
    [lineId, orderId],
    conn
  );
  return rows[0] ?? null;
}

export async function findByOrderAndPart(orderId, partId, conn) {
  const rows = await query('SELECT id FROM order_parts WHERE order_id = ? AND part_id = ? LIMIT 1', [orderId, partId], conn);
  return rows[0] ?? null;
}

// Líneas crudas de la orden, bloqueadas para devolver su stock al cancelar.
export async function listRawByOrderForUpdate(orderId, conn) {
  return query('SELECT id, part_id, quantity FROM order_parts WHERE order_id = ? ORDER BY part_id FOR UPDATE', [orderId], conn);
}

export async function insert({ orderId, partId, quantity, unitPrice }, conn) {
  const result = await query(
    'INSERT INTO order_parts (order_id, part_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
    [orderId, partId, quantity, unitPrice],
    conn
  );
  return result.insertId;
}

export async function updateQuantity(id, quantity, conn) {
  await query('UPDATE order_parts SET quantity = ? WHERE id = ?', [quantity, id], conn);
}

// Quita solo la línea; el rastro de lo ocurrido queda en los movimientos de inventario.
export async function remove(id, conn) {
  await query('DELETE FROM order_parts WHERE id = ?', [id], conn);
}
