import { query } from '../config/db.js';

// Versiones de los términos y aceptaciones (migración 009). Las versiones publicadas nunca se modifican.

const toVersion = (row) => ({
  id: row.id,
  version: row.version,
  termsText: row.terms_text,
  privacyText: row.privacy_text,
  publishedAt: row.published_at
});

/** Versión vigente (la de mayor número) o `null`. */
export async function findCurrent(conn) {
  const rows = await query(
    'SELECT id, version, terms_text, privacy_text, published_at FROM terms_versions ORDER BY version DESC LIMIT 1',
    [],
    conn
  );
  return rows[0] ? toVersion(rows[0]) : null;
}

export async function findByVersion(version, conn) {
  const rows = await query(
    'SELECT id, version, terms_text, privacy_text, published_at FROM terms_versions WHERE version = ? LIMIT 1',
    [version],
    conn
  );
  return rows[0] ? toVersion(rows[0]) : null;
}

/**
 * ¿El usuario aceptó la versión vigente? Una sola consulta (se ejecuta en cada petición autenticada). Sin ninguna
 * versión publicada responde `true`: no hay nada que aceptar.
 */
export async function hasAcceptedCurrent(userId, conn) {
  const rows = await query(
    `SELECT EXISTS(
              SELECT 1 FROM terms_acceptances a WHERE a.user_id = ? AND a.terms_version_id = v.id
            ) AS accepted
     FROM terms_versions v
     ORDER BY v.version DESC
     LIMIT 1`,
    [userId],
    conn
  );
  return rows[0] ? Boolean(rows[0].accepted) : true;
}

/** Registra la aceptación; si ya existía no la duplica (restricción única) y conserva la fecha original. */
export async function accept(userId, termsVersionId, conn) {
  await query('INSERT IGNORE INTO terms_acceptances (user_id, terms_version_id) VALUES (?, ?)', [userId, termsVersionId], conn);
  const rows = await query(
    'SELECT accepted_at FROM terms_acceptances WHERE user_id = ? AND terms_version_id = ? LIMIT 1',
    [userId, termsVersionId],
    conn
  );
  return rows[0].accepted_at;
}

/** Aceptaciones de la más reciente a la más antigua, con filtros por versión y usuario. `{ data, total }`. */
export async function listAcceptances({ version, userId, page = 1, pageSize = 20 } = {}, conn) {
  const conditions = [];
  const params = [];
  if (version) {
    conditions.push('v.version = ?');
    params.push(version);
  }
  if (userId) {
    conditions.push('a.user_id = ?');
    params.push(userId);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const from = `FROM terms_acceptances a
                JOIN terms_versions v ON v.id = a.terms_version_id
                JOIN users u ON u.id = a.user_id ${where}`;
  const [{ total }] = await query(`SELECT COUNT(*) AS total ${from}`, params, conn);
  const rows = await query(
    `SELECT a.user_id, u.name AS user_name, u.username, v.version, a.accepted_at
     ${from}
     ORDER BY a.accepted_at DESC, a.id DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize],
    conn
  );
  return {
    data: rows.map((row) => ({
      userId: row.user_id,
      userName: row.user_name,
      username: row.username,
      version: row.version,
      acceptedAt: row.accepted_at
    })),
    total: Number(total)
  };
}
