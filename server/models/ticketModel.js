import { query } from '../config/db.js';

// Un ticket por orden. Solo guarda el folio, quién y cuándo lo generó y el total de la orden en ese momento
// (como firma para avisar si la orden cambió después). El contenido se arma al consultar, con los datos vigentes.

function toTicketHead(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    folio: row.folio,
    orderId: row.order_id,
    orderTotal: Number(row.order_total),
    generatedByName: row.generated_by_name,
    generatedAt: row.generated_at
  };
}

export async function findByOrder(orderId, conn) {
  const rows = await query(
    `SELECT t.id, t.folio, t.order_id, t.order_total, t.generated_at, u.name AS generated_by_name
     FROM tickets t
     JOIN users u ON u.id = t.generated_by
     WHERE t.order_id = ? LIMIT 1`,
    [orderId],
    conn
  );
  return toTicketHead(rows[0]);
}

export async function insert({ folio, orderId, orderTotal, generatedBy }, conn) {
  await query('INSERT INTO tickets (folio, order_id, order_total, generated_by) VALUES (?, ?, ?, ?)', [
    folio,
    orderId,
    orderTotal,
    generatedBy
  ], conn);
}
