import { query } from '../config/db.js';

// Contadores de intentos fallidos de inicio de sesión (ver migración 003). Se usan dentro de una transacción.

/**
 * Bloquea el contador hasta que termine la transacción y devuelve su estado. Lo crea en cero si no existe: insertar y,
 * si ya está, «actualizar» sin cambios toma el bloqueo exclusivo de una vez y evita interbloqueos.
 */
export async function lock(attemptKey, conn) {
  await query(
    'INSERT INTO login_attempts (attempt_key, failed_count) VALUES (?, 0) ON DUPLICATE KEY UPDATE attempt_key = attempt_key',
    [attemptKey],
    conn
  );
  const [row] = await query(
    'SELECT failed_count, locked_until, updated_at FROM login_attempts WHERE attempt_key = ? FOR UPDATE',
    [attemptKey],
    conn
  );
  return {
    failedCount: row.failed_count,
    lockedUntil: row.locked_until ? new Date(row.locked_until) : null,
    // Un contador recién creado todavía no tiene fallos que caducar.
    updatedAt: row.failed_count > 0 ? new Date(row.updated_at) : null
  };
}

/** Guarda el contador, la fecha hasta la que queda bloqueado (o null) y el momento del último fallo. */
export async function save(attemptKey, failedCount, lockedUntil, updatedAt, conn) {
  await query(
    'UPDATE login_attempts SET failed_count = ?, locked_until = ?, updated_at = ? WHERE attempt_key = ?',
    [failedCount, lockedUntil, updatedAt, attemptKey],
    conn
  );
}

export async function reset(attemptKey, conn) {
  await query('DELETE FROM login_attempts WHERE attempt_key = ?', [attemptKey], conn);
}
