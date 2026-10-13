import { query } from '../config/db.js';

// Servicios realizados (order_services.cost) y mano de obra (order_labor.amount) de una orden.
// En la API ambos importes se llaman `amount`.

const toLine = (row) => ({ id: row.id, description: row.description, amount: Number(row.amount) });

export async function listServices(orderId, conn) {
  const rows = await query(
    'SELECT id, description, cost AS amount FROM order_services WHERE order_id = ? ORDER BY id',
    [orderId],
    conn
  );
  return rows.map(toLine);
}

export async function listLabor(orderId, conn) {
  const rows = await query(
    'SELECT id, description, amount FROM order_labor WHERE order_id = ? ORDER BY id',
    [orderId],
    conn
  );
  return rows.map(toLine);
}

// Cada tipo de línea vive en su tabla: los servicios guardan el importe en `cost` y la mano de obra en `amount`.
const LINE_TABLES = Object.freeze({
  services: { table: 'order_services', column: 'cost' },
  labor: { table: 'order_labor', column: 'amount' }
});

function lineTable(kind) {
  const config = LINE_TABLES[kind];
  if (!config) {
    throw new Error(`Tipo de línea desconocido: ${kind}`);
  }
  return config;
}

// Línea de una orden concreta (null si no existe o pertenece a otra orden).
export async function findLine(kind, orderId, lineId, conn) {
  const { table, column } = lineTable(kind);
  const rows = await query(
    `SELECT id, description, ${column} AS amount FROM ${table} WHERE id = ? AND order_id = ? LIMIT 1`,
    [lineId, orderId],
    conn
  );
  return rows[0] ? toLine(rows[0]) : null;
}

export async function insertLine(kind, orderId, { description, amount }, conn) {
  const { table, column } = lineTable(kind);
  const result = await query(
    `INSERT INTO ${table} (order_id, description, ${column}) VALUES (?, ?, ?)`,
    [orderId, description, amount],
    conn
  );
  return result.insertId;
}

export async function updateLine(kind, orderId, lineId, { description, amount }, conn) {
  const { table, column } = lineTable(kind);
  await query(
    `UPDATE ${table} SET description = ?, ${column} = ? WHERE id = ? AND order_id = ?`,
    [description, amount, lineId, orderId],
    conn
  );
}

// Quita una línea (nunca la orden): el filtro por order_id evita tocar líneas de otras órdenes.
export async function deleteLine(kind, orderId, lineId, conn) {
  const { table } = lineTable(kind);
  await query(`DELETE FROM ${table} WHERE id = ? AND order_id = ?`, [lineId, orderId], conn);
}
