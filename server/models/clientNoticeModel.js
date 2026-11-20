import { query } from '../config/db.js';
import { AppError } from '../utils/AppError.js';

// Hechos que originan un aviso al cliente y registro de los avisos hechos (Sprint 6). Los hechos no se guardan: se
// derivan de órdenes, citas y mantenimientos al consultar. Solo `client_notices` guarda que ya se avisó.

const VEHICLE_LABEL = "CONCAT(v.license_plate, ' · ', v.brand, ' ', v.model, ' ', v.year)";

/**
 * Órdenes TERMINADO sin entregar. Con `orderId` devuelve solo esa orden (para comprobar si el hecho sigue vigente).
 * `date` es el último paso a TERMINADO (o la creación, si faltara el historial).
 */
export async function listFinishedOrders({ orderId = null } = {}, conn) {
  const params = [];
  let filter = '';
  if (orderId !== null) {
    filter = 'AND o.id = ?';
    params.push(orderId);
  }
  const rows = await query(
    `SELECT o.id, o.folio, c.id AS client_id, c.name AS client_name, c.phone, ${VEHICLE_LABEL} AS vehicle_label,
            COALESCE(h.finished_at, o.created_at) AS date
     FROM service_orders o
     JOIN clients c ON c.id = o.client_id
     JOIN vehicles v ON v.id = o.vehicle_id
     LEFT JOIN (
       SELECT order_id, MAX(changed_at) AS finished_at FROM order_status_history WHERE to_status = 'TERMINADO' GROUP BY order_id
     ) h ON h.order_id = o.id
     WHERE o.status = 'TERMINADO' ${filter}
     ORDER BY date, o.id`,
    params,
    conn
  );
  return rows.map((row) => ({
    id: row.id,
    folio: row.folio,
    clientId: row.client_id,
    clientName: row.client_name,
    phone: row.phone,
    vehicleLabel: row.vehicle_label,
    date: row.date
  }));
}

/** Citas PENDIENTE o CONFIRMADA entre `from` y `to` (mañana). Con `appointmentId` devuelve solo esa cita. */
export async function listAppointmentsBetween({ from, to, appointmentId = null }, conn) {
  const params = [from, to];
  let filter = '';
  if (appointmentId !== null) {
    filter = 'AND a.id = ?';
    params.push(appointmentId);
  }
  const rows = await query(
    `SELECT a.id, a.scheduled_at AS date, c.id AS client_id, c.name AS client_name, c.phone, ${VEHICLE_LABEL} AS vehicle_label
     FROM appointments a
     JOIN clients c ON c.id = a.client_id
     JOIN vehicles v ON v.id = a.vehicle_id
     WHERE a.status IN ('PENDIENTE','CONFIRMADA') AND a.scheduled_at BETWEEN ? AND ? ${filter}
     ORDER BY a.scheduled_at, a.id`,
    params,
    conn
  );
  return rows.map((row) => ({
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    phone: row.phone,
    vehicleLabel: row.vehicle_label,
    date: row.date
  }));
}

/** Claves de hecho ya avisadas para un motivo: `Set` de `fact_key`. */
export async function listNoticedKeys(reason, conn) {
  const rows = await query('SELECT fact_key FROM client_notices WHERE reason = ?', [reason], conn);
  return new Set(rows.map((row) => row.fact_key));
}

/**
 * Registra el aviso y devuelve el registro con el nombre de quien avisó. La restricción única `(reason, fact_key)`
 * decide cuando dos solicitudes llegan a la vez: la segunda responde 409 NOTICE_ALREADY_REGISTERED.
 */
export async function insert({ clientId, reason, factKey, note, notifiedBy }, conn) {
  let id;
  try {
    const result = await query(
      'INSERT INTO client_notices (client_id, reason, fact_key, note, notified_by) VALUES (?, ?, ?, ?, ?)',
      [clientId, reason, factKey, note, notifiedBy],
      conn
    );
    id = result.insertId;
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      throw AppError.noticeAlreadyRegistered();
    }
    throw error;
  }
  const [row] = await query(
    `SELECT n.id, n.reason, n.fact_key, n.client_id, n.note, n.notified_by, u.name AS notified_by_name, n.notified_at
     FROM client_notices n JOIN users u ON u.id = n.notified_by WHERE n.id = ?`,
    [id],
    conn
  );
  return {
    id: row.id,
    reason: row.reason,
    factKey: row.fact_key,
    clientId: row.client_id,
    note: row.note,
    notifiedBy: row.notified_by,
    notifiedByName: row.notified_by_name,
    notifiedAt: row.notified_at
  };
}
