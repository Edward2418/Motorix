import { endOfDay, startOfDay } from './dashboardPeriods.js';
import { toCents } from '../utils/money.js';

// Reglas puras de los reportes (Sprint 7): el rango de fechas, los límites del día local y los importes en centavos.
// Los importes se suman siempre en centavos enteros: sumar decimales binarios (0.1 + 0.2) no coincide con los pagos.

export const MAX_RANGE_DAYS = 366;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

// Convierte `AAAA-MM-DD` en una fecha local; `null` si no es una fecha real (por ejemplo 2026-02-30).
function parseLocalDate(text) {
  const match = typeof text === 'string' ? DATE_PATTERN.exec(text) : null;
  if (!match) {
    return null;
  }
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

/** Primer instante del día local (00:00:00.000) de una fecha `AAAA-MM-DD`. */
export const dayStart = (text) => startOfDay(parseLocalDate(text));

/** Último instante del día local (23:59:59.999) de una fecha `AAAA-MM-DD`. */
export const dayEnd = (text) => endOfDay(parseLocalDate(text));

/**
 * Valida el rango de un reporte: ambas fechas `AAAA-MM-DD` reales, `from` no posterior a `to` y a lo sumo 366 días
 * (contando los dos extremos). Devuelve `{ ok: true, start, end, days }` o `{ ok: false, code, field?, message }`:
 * `VALIDATION_ERROR` para una fecha mal escrita y `REPORT_RANGE_INVALID` para un rango invertido o demasiado largo.
 */
export function validateRange(from, to) {
  const start = parseLocalDate(from);
  if (!start) {
    return { ok: false, code: 'VALIDATION_ERROR', field: 'from', message: 'La fecha inicial debe tener el formato AAAA-MM-DD y ser una fecha real.' };
  }
  const end = parseLocalDate(to);
  if (!end) {
    return { ok: false, code: 'VALIDATION_ERROR', field: 'to', message: 'La fecha final debe tener el formato AAAA-MM-DD y ser una fecha real.' };
  }
  if (start > end) {
    return { ok: false, code: 'REPORT_RANGE_INVALID', message: 'La fecha inicial no puede ser posterior a la final.' };
  }
  // Se cuentan días naturales con Date.UTC para que un cambio de horario no sume ni reste una hora.
  const days = Math.round((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / DAY_MS) + 1;
  if (days > MAX_RANGE_DAYS) {
    return { ok: false, code: 'REPORT_RANGE_INVALID', message: `El rango no puede pasar de ${MAX_RANGE_DAYS} días.` };
  }
  return { ok: true, start: startOfDay(start), end: endOfDay(end), days };
}

/** Suma importes (números o textos de DECIMAL) en centavos enteros. */
export function sumCents(amounts) {
  return amounts.reduce((total, amount) => total + toCents(amount), 0);
}

/** Centavos enteros a pesos con dos decimales. */
export function centsToPesos(cents) {
  return Math.round(cents) / 100;
}
