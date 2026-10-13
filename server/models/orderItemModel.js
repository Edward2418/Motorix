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
