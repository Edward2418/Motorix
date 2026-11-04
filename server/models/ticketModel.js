import { query } from '../config/db.js';

// Un ticket por orden. Guarda el folio, quién y cuándo lo generó, el total de la orden en ese momento (como firma para
// avisar si la orden cambió después) y, desde el Sprint 5, el contenido emitido (`content`: taller, cliente, vehículo,
// líneas, subtotales y total). Los tickets anteriores tienen `content` nulo y se arman al consultar con datos vigentes.
// Los pagos nunca se guardan en el ticket: se muestran vigentes.

// MySQL devuelve la columna JSON ya convertida en objeto; el texto se interpreta solo si llegara como cadena.
const parseContent = (value) => (typeof value === 'string' ? JSON.parse(value) : (value ?? null));

function toTicketHead(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    folio: row.folio,
    orderId: row.order_id,
    orderTotal: Number(row.order_total),
    content: parseContent(row.content),
    generatedByName: row.generated_by_name,
    generatedAt: row.generated_at
  };
}

export async function findByOrder(orderId, conn) {
  const rows = await query(
    `SELECT t.id, t.folio, t.order_id, t.order_total, t.content, t.generated_at, u.name AS generated_by_name
     FROM tickets t
     JOIN users u ON u.id = t.generated_by
     WHERE t.order_id = ? LIMIT 1`,
    [orderId],
    conn
  );
  return toTicketHead(rows[0]);
}

export async function insert({ folio, orderId, orderTotal, content = null, generatedBy }, conn) {
  await query(
    'INSERT INTO tickets (folio, order_id, order_total, content, generated_by) VALUES (?, ?, ?, ?, ?)',
    [folio, orderId, orderTotal, content === null ? null : JSON.stringify(content), generatedBy],
    conn
  );
}
