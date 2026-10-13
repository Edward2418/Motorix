import { query } from '../config/db.js';

// Historial de servicios de un vehículo: consulta derivada de las órdenes TERMINADO y ENTREGADO.
// No existe una tabla de historial; así una corrección posterior a la orden se refleja sola.

const money = (value) => Math.round(Number(value) * 100) / 100;

// Órdenes finalizadas del vehículo, de la más reciente a la más antigua. La fecha del servicio es el primer cambio
// a TERMINADO (si faltara, la entrega o la última actualización). Sin kilometraje del servicio se usa el de entrada.
export async function listFinished(vehicleId, { page, pageSize }) {
  const where = "o.vehicle_id = ? AND o.status IN ('TERMINADO','ENTREGADO')";
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM service_orders o WHERE ${where}`, [vehicleId]);
  const rows = await query(
    `SELECT o.id, o.folio, o.status, o.reported_problem, o.diagnosis, o.notes, o.recommendations,
            COALESCE(o.service_mileage, o.entry_mileage) AS service_mileage, m.name AS mechanic_name,
            COALESCE(
              (SELECT MIN(h.changed_at) FROM order_status_history h WHERE h.order_id = o.id AND h.to_status = 'TERMINADO'),
              o.delivered_at,
              o.updated_at
            ) AS service_date
     FROM service_orders o
     JOIN users m ON m.id = o.mechanic_id
     WHERE ${where}
     ORDER BY service_date DESC, o.id DESC
     LIMIT ? OFFSET ?`,
    [vehicleId, pageSize, (page - 1) * pageSize]
  );
  return { rows, total: Number(total) };
}

// Servicios, mano de obra y refacciones de varias órdenes, en tres consultas por lote (sin consultas por fila).
export async function listLinesByOrders(orderIds) {
  if (orderIds.length === 0) {
    return { services: [], labor: [], parts: [] };
  }
  const [services, labor, parts] = await Promise.all([
    query('SELECT order_id, description, cost AS amount FROM order_services WHERE order_id IN (?) ORDER BY id', [orderIds]),
    query('SELECT order_id, description, amount FROM order_labor WHERE order_id IN (?) ORDER BY id', [orderIds]),
    query(
      `SELECT op.order_id, op.part_id, p.code, p.name, op.quantity, op.unit_price
       FROM order_parts op JOIN parts p ON p.id = op.part_id
       WHERE op.order_id IN (?) ORDER BY op.id`,
      [orderIds]
    )
  ]);
  return {
    services: services.map((row) => ({ orderId: row.order_id, description: row.description, amount: money(row.amount) })),
    labor: labor.map((row) => ({ orderId: row.order_id, description: row.description, amount: money(row.amount) })),
    parts: parts.map((row) => ({
      orderId: row.order_id,
      partId: row.part_id,
      code: row.code,
      name: row.name,
      quantity: row.quantity,
      unitPrice: money(row.unit_price)
    }))
  };
}
