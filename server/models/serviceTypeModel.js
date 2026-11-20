import { query } from '../config/db.js';

// Catálogo de tipos de servicio (migración 009). Nunca se borra: un tipo usado se desactiva.

const toServiceType = (row) => ({
  id: row.id,
  name: row.name,
  intervalDays: row.interval_days,
  intervalKm: row.interval_km,
  active: Boolean(row.active)
});

const COLUMNS = 'id, name, interval_days, interval_km, active';

/** Tipos por nombre. `active`: `true` solo activos, `false` solo desactivados, `undefined` todos. */
export async function list({ active } = {}, conn) {
  const where = active === undefined ? '' : 'WHERE active = ?';
  const rows = await query(`SELECT ${COLUMNS} FROM service_types ${where} ORDER BY name, id`, active === undefined ? [] : [active ? 1 : 0], conn);
  return rows.map(toServiceType);
}

export async function findById(id, conn) {
  const rows = await query(`SELECT ${COLUMNS} FROM service_types WHERE id = ? LIMIT 1`, [id], conn);
  return rows[0] ? toServiceType(rows[0]) : null;
}

/** Tipos ligados a las líneas de servicio de una orden (con o sin repetidos, en el orden de las líneas). */
export async function listForOrder(orderId, conn) {
  const rows = await query(
    `SELECT t.id, t.name, t.interval_days, t.interval_km, t.active
     FROM order_services s
     JOIN service_types t ON t.id = s.service_type_id
     WHERE s.order_id = ?
     ORDER BY s.id`,
    [orderId],
    conn
  );
  return rows.map(toServiceType);
}

export async function insert({ name, intervalDays, intervalKm }, conn) {
  const result = await query('INSERT INTO service_types (name, interval_days, interval_km) VALUES (?, ?, ?)', [name, intervalDays, intervalKm], conn);
  return Number(result.insertId);
}

export async function update(id, { name, intervalDays, intervalKm }, conn) {
  await query('UPDATE service_types SET name = ?, interval_days = ?, interval_km = ? WHERE id = ?', [name, intervalDays, intervalKm, id], conn);
}

export async function setActive(id, active, conn) {
  await query('UPDATE service_types SET active = ? WHERE id = ?', [active ? 1 : 0, id], conn);
}
