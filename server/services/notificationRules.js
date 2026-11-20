// Reglas puras de las notificaciones internas (Sprint 6). No accede a la base de datos: recibe datos y decide.
// Los avisos no se guardan: se calculan al consultar. Aquí viven los tipos, su gravedad, qué rol ve qué,
// las claves que identifican cada aviso y la regla de «orden detenida».

// Tipos de aviso.
export const NOTIFICATION_TYPES = Object.freeze([
  'MAINTENANCE_SOON',
  'MAINTENANCE_OVERDUE',
  'APPOINTMENT_TODAY',
  'STOCK_LOW',
  'STOCK_OUT',
  'ORDER_STALE'
]);

// Gravedad: 1 normal (próximo, bajo, cita del día, orden detenida) y 2 grave (vencido, agotado).
// Un aviso leído vuelve a mostrarse como no leído si su gravedad actual supera la que tenía al leerlo.
const SEVERITY = Object.freeze({
  MAINTENANCE_SOON: 1,
  MAINTENANCE_OVERDUE: 2,
  APPOINTMENT_TODAY: 1,
  STOCK_LOW: 1,
  STOCK_OUT: 2,
  ORDER_STALE: 1
});

// Orden de los grupos en el panel: primero lo más urgente.
export const GROUP_ORDER = Object.freeze([
  'MAINTENANCE_OVERDUE',
  'STOCK_OUT',
  'MAINTENANCE_SOON',
  'STOCK_LOW',
  'APPOINTMENT_TODAY',
  'ORDER_STALE'
]);

export const TYPE_LABELS = Object.freeze({
  MAINTENANCE_OVERDUE: 'Mantenimientos vencidos',
  MAINTENANCE_SOON: 'Mantenimientos próximos',
  APPOINTMENT_TODAY: 'Citas de hoy',
  STOCK_LOW: 'Stock bajo',
  STOCK_OUT: 'Refacciones agotadas',
  ORDER_STALE: 'Órdenes detenidas'
});

// Prefijo de la clave de cada tipo (MAINT:12, APPT:7, STOCK:3, ORDER:41).
const KEY_PREFIX = Object.freeze({
  MAINTENANCE_SOON: 'MAINT',
  MAINTENANCE_OVERDUE: 'MAINT',
  APPOINTMENT_TODAY: 'APPT',
  STOCK_LOW: 'STOCK',
  STOCK_OUT: 'STOCK',
  ORDER_STALE: 'ORDER'
});

// Qué tipos recibe cada rol. El stock nunca llega a recepción ni a mecánico; el mecánico solo recibe órdenes detenidas.
const VISIBLE_BY_ROLE = Object.freeze({
  ADMIN: NOTIFICATION_TYPES,
  RECEPTIONIST: Object.freeze(['MAINTENANCE_SOON', 'MAINTENANCE_OVERDUE', 'APPOINTMENT_TODAY', 'ORDER_STALE']),
  MECHANIC: Object.freeze(['ORDER_STALE'])
});

export function severityOf(type) {
  const severity = SEVERITY[type];
  if (severity === undefined) {
    throw new Error(`Tipo de aviso desconocido: ${type}`);
  }
  return severity;
}

export function keyPrefixOf(type) {
  const prefix = KEY_PREFIX[type];
  if (prefix === undefined) {
    throw new Error(`Tipo de aviso desconocido: ${type}`);
  }
  return prefix;
}

/** Tipos que el rol puede ver. Devuelve una copia: modificarla no altera la matriz. Un rol desconocido no ve ninguno. */
export function visibleTypes(role) {
  return [...(VISIBLE_BY_ROLE[role] ?? [])];
}

const KEY_PATTERN = /^(MAINT|APPT|STOCK|ORDER):([0-9]+)$/;
const MAX_KEY_LENGTH = 60;

/** Arma la clave `TIPO:id` de un aviso. Lanza si el prefijo o el id no son válidos. */
export function buildKey(prefix, id) {
  if (!['MAINT', 'APPT', 'STOCK', 'ORDER'].includes(prefix)) {
    throw new Error(`Prefijo de aviso desconocido: ${prefix}`);
  }
  if (!Number.isInteger(id) || id < 1) {
    throw new Error('El id del aviso debe ser un entero positivo.');
  }
  return `${prefix}:${id}`;
}

/** Descompone una clave en `{ prefix, id }`; devuelve `null` si no cumple `^(MAINT|APPT|STOCK|ORDER):[0-9]+$`. */
export function parseKey(key) {
  if (typeof key !== 'string' || key.length > MAX_KEY_LENGTH) {
    return null;
  }
  const match = KEY_PATTERN.exec(key);
  if (!match) {
    return null;
  }
  const id = Number(match[2]);
  return Number.isSafeInteger(id) && id >= 1 ? { prefix: match[1], id } : null;
}

// Una orden detenida lleva más de 3 días sin cambio de estado (valor fijo, no configurable).
export const STALE_AFTER_DAYS = 3;
const MS_PER_DAY = 86400000;

// Estados abiertos que pueden quedar detenidos. TERMINADO queda fuera porque ya aparece en «Clientes por avisar».
const STALE_CANDIDATE_STATUSES = Object.freeze(['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION']);

export function staleCandidateStatuses() {
  return [...STALE_CANDIDATE_STATUSES];
}

/**
 * Una orden está detenida si su estado es uno de los abiertos no terminados y su último cambio de estado fue hace
 * MÁS de `STALE_AFTER_DAYS` días (a exactamente 3 días todavía no).
 */
export function isStaleOrder({ status, lastChangeAt, now = new Date() }) {
  if (!STALE_CANDIDATE_STATUSES.includes(status)) {
    return false;
  }
  const last = new Date(lastChangeAt).getTime();
  if (Number.isNaN(last)) {
    return false;
  }
  return new Date(now).getTime() - last > STALE_AFTER_DAYS * MS_PER_DAY;
}
