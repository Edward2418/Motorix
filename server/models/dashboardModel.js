import { query } from '../config/db.js';
import { ORDER_TOTAL_SQL, PAID_TOTAL_SQL } from './orderModel.js';

// Consultas de solo lectura del panel de control. Todo se calcula al consultar: no hay tablas de estadísticas.
// Los importes usan los mismos fragmentos SQL que la orden (orderModel), así que nunca difieren de lo que muestra.

const money = (value) => Math.round(Number(value) * 100) / 100;

const ORDER_REF_FROM = `
  FROM service_orders o
  JOIN clients c ON c.id = o.client_id
  JOIN vehicles v ON v.id = o.vehicle_id`;

const ORDER_REF_COLUMNS = `
  o.id, o.folio, o.status, c.name AS client_name,
  CONCAT(v.license_plate, ' · ', v.brand, ' ', v.model, ' ', v.year) AS vehicle_label,
  ${ORDER_TOTAL_SQL} AS total, ${PAID_TOTAL_SQL} AS paid`;

function toOrderRef(row) {
  const total = money(row.total);
  return {
    id: row.id,
    folio: row.folio,
    clientName: row.client_name,
    vehicleLabel: row.vehicle_label,
    status: row.status,
    total,
    balance: Math.max(0, money(total - money(row.paid))),
    finishedAt: row.finished_at ?? null
  };
}

/** Cantidad de órdenes por estado: { RECIBIDO: n, ... } (solo los estados con órdenes). */
export async function countByStatus() {
  const rows = await query('SELECT status, COUNT(*) AS total FROM service_orders GROUP BY status');
  return Object.fromEntries(rows.map((row) => [row.status, Number(row.total)]));
}

/** Importe cobrado: suma de pagos PAGADO con paid_at dentro del periodo. */
export async function sumCollected({ from, to }) {
  const [row] = await query("SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'PAGADO' AND paid_at BETWEEN ? AND ?", [from, to]);
  return money(row.total);
}

/** Órdenes cuyo primer paso a TERMINADO ocurrió dentro del periodo: cada orden cuenta una sola vez. */
export async function finishedOrders({ from, to, limit }) {
  const base = `
    FROM (
      SELECT order_id, MIN(changed_at) AS finished_at
      FROM order_status_history
      WHERE to_status = 'TERMINADO'
      GROUP BY order_id
      HAVING MIN(changed_at) BETWEEN ? AND ?
    ) f
    JOIN service_orders o ON o.id = f.order_id
    JOIN clients c ON c.id = o.client_id
    JOIN vehicles v ON v.id = o.vehicle_id`;
  const [{ total }] = await query(`SELECT COUNT(*) AS total ${base}`, [from, to]);
  const rows = await query(`SELECT ${ORDER_REF_COLUMNS}, f.finished_at ${base} ORDER BY f.finished_at DESC, o.id DESC LIMIT ?`, [from, to, limit]);
  return { count: Number(total), items: rows.map(toOrderRef) };
}

/** Citas PENDIENTE o CONFIRMADA entre dos fechas, de la más próxima a la más lejana. */
export async function upcomingAppointments({ from, to, limit }) {
  const where = "a.status IN ('PENDIENTE','CONFIRMADA') AND a.scheduled_at BETWEEN ? AND ?";
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM appointments a WHERE ${where}`, [from, to]);
  const rows = await query(
    `SELECT a.id, a.scheduled_at, a.status, c.name AS client_name,
            CONCAT(v.license_plate, ' · ', v.brand, ' ', v.model, ' ', v.year) AS vehicle_label
     FROM appointments a
     JOIN clients c ON c.id = a.client_id
     JOIN vehicles v ON v.id = a.vehicle_id
     WHERE ${where}
     ORDER BY a.scheduled_at, a.id
     LIMIT ?`,
    [from, to, limit]
  );
  return {
    count: Number(total),
    items: rows.map((row) => ({
      id: row.id,
      scheduledAt: row.scheduled_at,
      clientName: row.client_name,
      vehicleLabel: row.vehicle_label,
      status: row.status
    }))
  };
}

/** Órdenes TERMINADO o ENTREGADO con saldo por cobrar (total menos lo cobrado): suma, número y las de mayor saldo. */
export async function pendingBalances({ limit }) {
  const base = `
    SELECT ${ORDER_REF_COLUMNS}, (${ORDER_TOTAL_SQL} - ${PAID_TOTAL_SQL}) AS balance
    ${ORDER_REF_FROM}
    WHERE o.status IN ('TERMINADO','ENTREGADO')`;
  const [summary] = await query(`SELECT COUNT(*) AS count, COALESCE(SUM(balance), 0) AS total FROM (${base}) t WHERE balance > 0`);
  const rows = await query(`SELECT * FROM (${base}) t WHERE balance > 0 ORDER BY balance DESC, id LIMIT ?`, [limit]);
  return { total: money(summary.total), count: Number(summary.count), items: rows.map(toOrderRef) };
}
