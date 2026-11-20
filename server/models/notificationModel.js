import { query } from '../config/db.js';

// Lecturas de avisos por usuario (Sprint 6). Es el único estado que se guarda de los avisos del centro:
// los avisos en sí se calculan al consultar (research D-01).

/** Lecturas del usuario: `[{ key, severity }]`. */
export async function listReads(userId, conn) {
  const rows = await query(
    'SELECT notification_key AS `key`, severity FROM notification_reads WHERE user_id = ?',
    [userId],
    conn
  );
  return rows.map((row) => ({ key: row.key, severity: Number(row.severity) }));
}

/** Guarda la lectura con la gravedad del aviso en ese momento. Marcar dos veces actualiza la fila, no la duplica. */
export async function upsertRead(userId, key, severity, conn) {
  await query(
    `INSERT INTO notification_reads (user_id, notification_key, severity)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE severity = VALUES(severity), read_at = CURRENT_TIMESTAMP`,
    [userId, key, severity],
    conn
  );
}

/**
 * Citas del día entre `from` y `to` (inicio y fin de hoy). Misma condición del panel: solo `PENDIENTE` o `CONFIRMADA`.
 * Trae cliente, vehículo y hora, de la más temprana a la más tarde.
 */
export async function todayAppointments({ from, to }, conn) {
  const rows = await query(
    `SELECT a.id, a.scheduled_at, a.status, c.name AS client_name,
            CONCAT(v.license_plate, ' · ', v.brand, ' ', v.model, ' ', v.year) AS vehicle_label
     FROM appointments a
     JOIN clients c ON c.id = a.client_id
     JOIN vehicles v ON v.id = a.vehicle_id
     WHERE a.status IN ('PENDIENTE','CONFIRMADA') AND a.scheduled_at BETWEEN ? AND ?
     ORDER BY a.scheduled_at, a.id`,
    [from, to],
    conn
  );
  return rows.map((row) => ({
    id: row.id,
    scheduledAt: row.scheduled_at,
    status: row.status,
    clientName: row.client_name,
    vehicleLabel: row.vehicle_label
  }));
}

/**
 * Órdenes abiertas (RECIBIDO, DIAGNOSTICO, EN_REPARACION, ESPERANDO_REFACCION) cuyo último cambio de estado es
 * anterior a `olderThan`. El último cambio es `COALESCE(MAX(order_status_history.changed_at), service_orders.created_at)`,
 * en una sola consulta agregada (sin consultar el historial orden por orden). Con `mechanicId` filtra por el mecánico
 * asignado en la propia consulta.
 */
export async function listStaleOrders({ olderThan, mechanicId = null }, conn) {
  const params = [olderThan];
  let mechanicFilter = '';
  if (mechanicId !== null) {
    mechanicFilter = 'AND o.mechanic_id = ?';
    params.push(mechanicId);
  }
  const rows = await query(
    `SELECT o.id, o.folio, o.status, c.name AS client_name,
            CONCAT(v.license_plate, ' · ', v.brand, ' ', v.model, ' ', v.year) AS vehicle_label,
            COALESCE(h.last_change, o.created_at) AS last_change_at
     FROM service_orders o
     JOIN clients c ON c.id = o.client_id
     JOIN vehicles v ON v.id = o.vehicle_id
     LEFT JOIN (
       SELECT order_id, MAX(changed_at) AS last_change FROM order_status_history GROUP BY order_id
     ) h ON h.order_id = o.id
     WHERE o.status IN ('RECIBIDO','DIAGNOSTICO','EN_REPARACION','ESPERANDO_REFACCION')
       AND COALESCE(h.last_change, o.created_at) < ?
       ${mechanicFilter}
     ORDER BY last_change_at, o.id`,
    params,
    conn
  );
  return rows.map((row) => ({
    id: row.id,
    folio: row.folio,
    status: row.status,
    clientName: row.client_name,
    vehicleLabel: row.vehicle_label,
    lastChangeAt: row.last_change_at
  }));
}

/**
 * Elimina las lecturas de ESE usuario cuyas claves ya no están entre `activeKeys` (los avisos que sigue teniendo).
 * Con una lista vacía elimina todas las suyas. Nunca toca las lecturas de otros usuarios.
 */
export async function deleteReadsNotIn(userId, activeKeys, conn) {
  if (activeKeys.length === 0) {
    await query('DELETE FROM notification_reads WHERE user_id = ?', [userId], conn);
    return;
  }
  await query('DELETE FROM notification_reads WHERE user_id = ? AND notification_key NOT IN (?)', [userId, activeKeys], conn);
}
