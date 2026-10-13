import { query } from '../config/db.js';

// Registro de intentos fallidos de inicio de sesión por cuenta (ver migración 003).

export async function get(attemptKey) {
  const rows = await query(
    'SELECT attempt_key, failed_count, locked_until FROM login_attempts WHERE attempt_key = ? LIMIT 1',
    [attemptKey]
  );
  const row = rows[0];
  if (!row) {
    return null;
  }
  return {
    key: row.attempt_key,
    failedCount: row.failed_count,
    lockedUntil: row.locked_until ? new Date(row.locked_until) : null
  };
}

// Guarda el nuevo contador y, si corresponde, la fecha hasta la que la cuenta queda bloqueada.
export async function save(attemptKey, failedCount, lockedUntil) {
  await query(
    `INSERT INTO login_attempts (attempt_key, failed_count, locked_until) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE failed_count = VALUES(failed_count), locked_until = VALUES(locked_until)`,
    [attemptKey, failedCount, lockedUntil]
  );
}

export async function reset(attemptKey) {
  await query('DELETE FROM login_attempts WHERE attempt_key = ?', [attemptKey]);
}
