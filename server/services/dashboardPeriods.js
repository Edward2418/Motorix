// Periodos del panel de control. Módulo puro: recibe la fecha de referencia y devuelve los límites con la fecha
// local del servidor (no UTC), para que «hoy» sea el día del taller.

export const PERIOD_KEYS = Object.freeze(['today', 'week', 'month']);

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
const endOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

/**
 * today: el día de hoy. week: hoy y los seis días anteriores. month: del día 1 del mes en curso hasta el fin de hoy.
 * Devuelve { key, from, to }.
 */
export function resolvePeriod(key, now = new Date()) {
  const to = endOfDay(now);
  if (key === 'today') {
    return { key, from: startOfDay(now), to };
  }
  if (key === 'week') {
    const from = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
    return { key, from, to };
  }
  if (key === 'month') {
    return { key, from: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0), to };
  }
  throw new Error(`El periodo debe ser uno de: ${PERIOD_KEYS.join(', ')}.`);
}

/** Rango de las citas próximas: de ahora al final del séptimo día. */
export function upcomingRange(now = new Date()) {
  return { from: new Date(now.getTime()), to: endOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7)) };
}
