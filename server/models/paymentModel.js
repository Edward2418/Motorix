import { query } from '../config/db.js';

const PAYMENT_SELECT = `
  SELECT p.id, p.order_id, o.folio AS order_folio, p.amount, p.method, p.status, p.reference, p.external_reference,
         p.external_preference_id, p.external_payment_id, p.payment_link, p.expires_at, p.paid_at, p.cancel_reason,
         p.cancelled_at, p.created_at, u.name AS created_by_name, cu.name AS cancelled_by_name
  FROM payments p
  JOIN service_orders o ON o.id = p.order_id
  JOIN users u ON u.id = p.created_by
  LEFT JOIN users cu ON cu.id = p.cancelled_by`;

// Convierte una fila SQL en el objeto de la API. No incluye datos internos del servicio externo, salvo el enlace de pago
// mientras el pago de Mercado Pago sigue pendiente.
export function toPayment(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    orderId: row.order_id,
    orderFolio: row.order_folio,
    amount: Number(row.amount),
    method: row.method,
    status: row.status,
    reference: row.reference,
    paymentLink: row.status === 'PENDIENTE' ? row.payment_link : null,
    expiresAt: row.expires_at,
    paidAt: row.paid_at,
    cancelReason: row.cancel_reason,
    createdByName: row.created_by_name,
    cancelledByName: row.cancelled_by_name,
    createdAt: row.created_at
  };
}

// Pagos de una orden, del más reciente al más antiguo.
export async function listByOrder(orderId, conn) {
  const rows = await query(`${PAYMENT_SELECT} WHERE p.order_id = ? ORDER BY p.created_at DESC, p.id DESC`, [orderId], conn);
  return rows.map(toPayment);
}

// Solo estado e importe, para calcular el resumen.
export async function listForSummary(orderId, conn) {
  return query('SELECT status, amount FROM payments WHERE order_id = ?', [orderId], conn);
}

// Fila interna (con las referencias del servicio externo) para la conciliación de Mercado Pago.
export async function findRawById(id, conn) {
  const rows = await query('SELECT * FROM payments WHERE id = ? LIMIT 1', [id], conn);
  return rows[0] ?? null;
}

export async function findById(id, conn) {
  const rows = await query(`${PAYMENT_SELECT} WHERE p.id = ? LIMIT 1`, [id], conn);
  return toPayment(rows[0]);
}

export async function insert(data, conn) {
  const result = await query(
    `INSERT INTO payments
       (order_id, amount, method, status, reference, external_reference, external_preference_id, payment_link,
        expires_at, paid_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.orderId,
      data.amount,
      data.method,
      data.status,
      data.reference ?? null,
      data.externalReference ?? null,
      data.externalPreferenceId ?? null,
      data.paymentLink ?? null,
      data.expiresAt ?? null,
      data.status === 'PAGADO' ? new Date() : null,
      data.createdBy
    ],
    conn
  );
  return result.insertId;
}

// Resuelve un pago pendiente de Mercado Pago (PAGADO o RECHAZADO) solo si sigue PENDIENTE. Devuelve true si se aplicó.
export async function markResolved(id, { status, paidAt = null, externalPaymentId = null }, conn) {
  const result = await query(
    `UPDATE payments
     SET status = ?, paid_at = ?, external_payment_id = COALESCE(?, external_payment_id)
     WHERE id = ? AND status = 'PENDIENTE'`,
    [status, paidAt, externalPaymentId, id],
    conn
  );
  return result.affectedRows === 1;
}

// Cancela solo si el pago sigue en uno de los estados permitidos. Devuelve true si se aplicó.
export async function markCancelled(id, allowedStatuses, { reason, cancelledBy }, conn) {
  const result = await query(
    `UPDATE payments
     SET status = 'CANCELADO', cancel_reason = ?, cancelled_by = ?, cancelled_at = NOW()
     WHERE id = ? AND status IN (?)`,
    [reason, cancelledBy, id, allowedStatuses],
    conn
  );
  return result.affectedRows === 1;
}
