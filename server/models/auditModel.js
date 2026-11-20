import { query } from '../config/db.js';

// Bitácora de acciones sensibles (Sprint 7). Solo se puede insertar y consultar: este módulo NO exporta ninguna función
// que edite o borre registros, y una prueba automática (auditImmutability) lo verifica sobre todo el código del servidor.

const toEntry = (row) => ({
  id: Number(row.id),
  userId: row.user_id,
  actor: row.actor,
  action: row.action,
  entity: row.entity,
  entityId: row.entity_id,
  detail: row.detail,
  createdAt: row.created_at
});

/** Agrega un registro y devuelve su id. */
export async function insert({ userId, actor, action, entity, entityId, detail }, conn) {
  const result = await query(
    'INSERT INTO audit_log (user_id, actor, action, entity, entity_id, detail) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, actor, action, entity, entityId, detail],
    conn
  );
  return Number(result.insertId);
}

/**
 * Registros de la más reciente a la más antigua, con filtros opcionales por fecha (`from` y `to` son fechas completas,
 * ambas incluidas), usuario y acción, y paginación. Devuelve `{ data, total }`.
 */
export async function list({ from, to, userId, action, page = 1, pageSize = 50 } = {}, conn) {
  const conditions = [];
  const params = [];
  if (from) {
    conditions.push('created_at >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('created_at <= ?');
    params.push(to);
  }
  if (userId) {
    conditions.push('user_id = ?');
    params.push(userId);
  }
  if (action) {
    conditions.push('action = ?');
    params.push(action);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM audit_log ${where}`, params, conn);
  const rows = await query(
    `SELECT id, user_id, actor, action, entity, entity_id, detail, created_at
     FROM audit_log ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize],
    conn
  );
  return { data: rows.map(toEntry), total: Number(total) };
}
