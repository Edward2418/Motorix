import { createHash } from 'node:crypto';
import { withTransaction } from '../config/db.js';
import * as loginAttemptModel from '../models/loginAttemptModel.js';

// Límite de intentos de inicio de sesión. Cada intento se RESERVA antes de comprobar la contraseña, dentro de una
// transacción que bloquea sus contadores: así los intentos simultáneos no pueden saltarse el límite.
//
// Hay tres contadores y basta con que uno esté bloqueado para rechazar:
//   - cuenta y origen: 5 fallos consecutivos desde el mismo origen (así otro no deja fuera al dueño de la cuenta);
//   - cuenta: 20 fallos en total repartidos entre orígenes, olvidados tras 15 minutos sin fallos;
//   - origen: 20 fallos contra cualquier cuenta, olvidados tras 15 minutos sin fallos.

export const MAX_FAILED_PER_PAIR = 5;
export const MAX_FAILED_PER_ACCOUNT = 20;
export const MAX_FAILED_PER_ORIGIN = 20;
export const LOCK_MINUTES = 15;

const WINDOW_MS = LOCK_MINUTES * 60000;

// Un identificador sin cuenta se guarda como hash: ocupa siempre lo mismo y no deja escrito lo que alguien tecleó.
const accountOf = (row, identifier) =>
  row ? `u:${row.id}` : `x:${createHash('sha256').update(identifier.trim().toLowerCase()).digest('hex')}`;

function countersFor(row, identifier, ip) {
  const account = accountOf(row, identifier);
  return [
    { kind: 'pair', key: `p:${account}|${ip}`, limit: MAX_FAILED_PER_PAIR, windowed: false },
    { kind: 'account', key: `a:${account}`, limit: MAX_FAILED_PER_ACCOUNT, windowed: true },
    { kind: 'origin', key: `o:${ip}`, limit: MAX_FAILED_PER_ORIGIN, windowed: true }
  ];
}

// Siempre en el mismo orden, para que dos intentos no se bloqueen entre sí.
const byKey = (a, b) => a.key.localeCompare(b.key);

// Se trunca a segundos porque DATETIME no guarda fracciones y MySQL redondearía hacia arriba.
const lockFrom = (now) => new Date(Math.floor((now + WINDOW_MS) / 1000) * 1000);

/**
 * Reserva un intento. Devuelve `{ allowed: false, lockedUntil }` si algún contador está bloqueado (no cuenta nada), o
 * `{ allowed: true, counters, locksAccount }` tras contarlo como fallo; si la contraseña resulta correcta, se devuelve
 * con `release`.
 */
export function reserve(row, identifier, ip) {
  const counters = countersFor(row, identifier, ip).sort(byKey);
  return withTransaction(async (conn) => {
    const now = Date.now();
    const states = [];
    for (const counter of counters) {
      states.push({ ...counter, previous: await loginAttemptModel.lock(counter.key, conn) });
    }
    const locks = states.map((s) => s.previous.lockedUntil).filter((until) => until && until.getTime() > now);
    if (locks.length > 0) {
      return { allowed: false, lockedUntil: new Date(Math.max(...locks.map((until) => until.getTime()))) };
    }
    let locksAccount = false;
    for (const { kind, key, limit, windowed, previous } of states) {
      const expired = previous.lockedUntil !== null;
      const stale = windowed && previous.updatedAt && now - previous.updatedAt.getTime() > WINDOW_MS;
      const count = (expired || stale ? 0 : previous.failedCount) + 1;
      const lockedUntil = count >= limit ? lockFrom(now) : null;
      await loginAttemptModel.save(key, count, lockedUntil, new Date(now), conn);
      locksAccount ||= lockedUntil !== null && kind !== 'origin';
    }
    return { allowed: true, counters, locksAccount };
  });
}

/** El intento reservado fue correcto: se olvidan los fallos de la cuenta y se descuenta este intento del origen. */
export function release({ counters }) {
  return withTransaction(async (conn) => {
    for (const { kind, key, limit } of counters) {
      if (kind !== 'origin') {
        await loginAttemptModel.reset(key, conn);
        continue;
      }
      const previous = await loginAttemptModel.lock(key, conn);
      const count = previous.failedCount - 1;
      if (count <= 0) {
        await loginAttemptModel.reset(key, conn);
      } else {
        await loginAttemptModel.save(key, count, count >= limit ? previous.lockedUntil : null, previous.updatedAt ?? new Date(), conn);
      }
    }
  });
}
