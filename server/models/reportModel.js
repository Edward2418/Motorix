import { query } from '../config/db.js';

// Consultas de los reportes (Sprint 7). Solo leen; todas con parámetros. Los importes salen en centavos enteros
// (`ROUND(SUM(amount) * 100)`) para sumar sin errores de redondeo.

/** Pagos cobrados (PAGADO) con `paid_at` dentro de `[start, end]`, por método: `{ method, cents, count }`. */
export async function incomeByMethod({ start, end }, conn) {
  const rows = await query(
    `SELECT method, ROUND(SUM(amount) * 100) AS cents, COUNT(*) AS count
     FROM payments
     WHERE status = 'PAGADO' AND paid_at >= ? AND paid_at <= ?
     GROUP BY method
     ORDER BY method`,
    [start, end],
    conn
  );
  return rows.map((row) => ({ method: row.method, cents: Number(row.cents), count: Number(row.count) }));
}

/** Los mismos pagos por día local de cobro: `{ date: 'AAAA-MM-DD', cents }`, del más antiguo al más reciente. */
export async function incomeByDay({ start, end }, conn) {
  const rows = await query(
    `SELECT DATE_FORMAT(paid_at, '%Y-%m-%d') AS day, ROUND(SUM(amount) * 100) AS cents
     FROM payments
     WHERE status = 'PAGADO' AND paid_at >= ? AND paid_at <= ?
     GROUP BY day
     ORDER BY day`,
    [start, end],
    conn
  );
  return rows.map((row) => ({ date: row.day, cents: Number(row.cents) }));
}

// Órdenes cuyo primer paso a TERMINADO cae en el rango (la misma regla del panel): cada orden aparece una sola vez.
const FINISHED_ORDERS_SQL = `
  SELECT order_id
  FROM order_status_history
  WHERE to_status = 'TERMINADO'
  GROUP BY order_id
  HAVING MIN(changed_at) >= ? AND MIN(changed_at) <= ?`;

/**
 * Líneas de servicio de las órdenes terminadas en el rango, agrupadas por tipo de servicio y, sin tipo, por descripción:
 * `{ serviceTypeId, name, count, cents }`, del más al menos frecuente.
 */
export async function serviceFrequency({ start, end }, conn) {
  const rows = await query(
    `SELECT s.service_type_id, COALESCE(t.name, s.description) AS name, COUNT(*) AS count, ROUND(SUM(s.cost) * 100) AS cents
     FROM (${FINISHED_ORDERS_SQL}) f
     JOIN order_services s ON s.order_id = f.order_id
     LEFT JOIN service_types t ON t.id = s.service_type_id
     GROUP BY s.service_type_id, COALESCE(t.name, s.description)
     ORDER BY count DESC, cents DESC, name`,
    [start, end],
    conn
  );
  return rows.map((row) => ({ serviceTypeId: row.service_type_id, name: row.name, count: Number(row.count), cents: Number(row.cents) }));
}

/** Por mecánico: órdenes terminadas en el rango e importe de su mano de obra, en centavos. */
export async function mechanicProductivity({ start, end }, conn) {
  const rows = await query(
    `SELECT u.id AS mechanic_id, u.name AS mechanic_name, COUNT(*) AS finished_orders,
            ROUND(SUM(COALESCE(l.total, 0)) * 100) AS cents
     FROM (${FINISHED_ORDERS_SQL}) f
     JOIN service_orders o ON o.id = f.order_id
     JOIN users u ON u.id = o.mechanic_id
     LEFT JOIN (SELECT order_id, SUM(amount) AS total FROM order_labor GROUP BY order_id) l ON l.order_id = o.id
     GROUP BY u.id, u.name
     ORDER BY finished_orders DESC, u.name, u.id`,
    [start, end],
    conn
  );
  return rows.map((row) => ({
    mechanicId: row.mechanic_id,
    mechanicName: row.mechanic_name,
    finishedOrders: Number(row.finished_orders),
    laborCents: Number(row.cents)
  }));
}

/**
 * Refacciones usadas en las órdenes terminadas en el rango, una fila por refacción y precio de venta de la línea, con el
 * precio de compra vigente de la refacción.
 */
export async function partsSold({ start, end }, conn) {
  const rows = await query(
    `SELECT p.id AS part_id, p.code, p.name, SUM(op.quantity) AS quantity,
            ROUND(op.unit_price * 100) AS sale_cents, ROUND(p.purchase_price * 100) AS purchase_cents
     FROM (${FINISHED_ORDERS_SQL}) f
     JOIN order_parts op ON op.order_id = f.order_id
     JOIN parts p ON p.id = op.part_id
     GROUP BY p.id, p.code, p.name, op.unit_price, p.purchase_price
     ORDER BY p.name, p.id, op.unit_price`,
    [start, end],
    conn
  );
  return rows.map((row) => ({
    partId: row.part_id,
    code: row.code,
    name: row.name,
    quantity: Number(row.quantity),
    saleCents: Number(row.sale_cents),
    purchaseCents: Number(row.purchase_cents)
  }));
}

/**
 * Por refacción: unidades de movimientos SALIDA en el rango y existencia al inicio y al final, reconstruidas como la suma
 * de los movimientos anteriores a cada momento. Omite las que no tuvieron existencia ni salidas.
 */
export async function inventoryFlow({ start, end }, conn) {
  const rows = await query(
    `SELECT p.id AS part_id, p.code, p.name,
            SUM(CASE WHEN m.type = 'SALIDA' AND m.created_at >= ? THEN -m.quantity ELSE 0 END) AS units_out,
            SUM(CASE WHEN m.created_at < ? THEN m.quantity ELSE 0 END) AS initial_stock,
            SUM(m.quantity) AS final_stock
     FROM inventory_movements m
     JOIN parts p ON p.id = m.part_id
     WHERE m.created_at <= ?
     GROUP BY p.id, p.code, p.name
     HAVING units_out > 0 OR initial_stock > 0 OR final_stock > 0
     ORDER BY units_out DESC, p.name, p.id`,
    [start, start, end],
    conn
  );
  return rows.map((row) => ({
    partId: row.part_id,
    code: row.code,
    name: row.name,
    unitsOut: Number(row.units_out),
    initialStock: Number(row.initial_stock),
    finalStock: Number(row.final_stock)
  }));
}
