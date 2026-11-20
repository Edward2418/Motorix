// Reglas de la configuración del taller (Sprint 7). Módulo puro: sin base de datos ni entorno, para poder probarlo solo.
// Valor vigente de cada clave: valor guardado y válido → valor de la configuración del servidor (.env) → predeterminado.

/** Lista cerrada de claves que se pueden guardar. Cualquier otra se rechaza. */
export const SETTING_KEYS = Object.freeze([
  'workshop_name',
  'workshop_address',
  'workshop_phone',
  'maintenance_soon_days',
  'maintenance_soon_km'
]);

/** Valores predeterminados (los mismos que ya traía `config/env.js`). */
export const DEFAULT_SETTINGS = Object.freeze({
  workshop_name: 'Taller Motorix (ejemplo)',
  workshop_address: 'Av. Principal 123, Ciudad de México',
  workshop_phone: '55 0000 0000',
  maintenance_soon_days: 30,
  maintenance_soon_km: 1000
});

/** Límites de cada clave: texto de `min` a `max` caracteres, o entero de `min` a `max`. */
export const SETTING_LIMITS = Object.freeze({
  workshop_name: { type: 'text', min: 1, max: 100, label: 'El nombre del taller' },
  workshop_address: { type: 'text', min: 1, max: 200, label: 'La dirección del taller' },
  workshop_phone: { type: 'text', min: 1, max: 30, label: 'El teléfono del taller' },
  maintenance_soon_days: { type: 'integer', min: 1, max: 365, label: 'El margen en días' },
  maintenance_soon_km: { type: 'integer', min: 100, max: 50000, label: 'El margen en kilómetros' }
});

const format = (number) => number.toLocaleString('en-US');

function validateText(limit, value) {
  if (typeof value !== 'string') {
    return { valid: false, message: `${limit.label} debe ser un texto.` };
  }
  const text = value.trim();
  if (text.length < limit.min) {
    return { valid: false, message: `${limit.label} es obligatorio.` };
  }
  if (text.length > limit.max) {
    return { valid: false, message: `${limit.label} no puede pasar de ${limit.max} caracteres.` };
  }
  return { valid: true, value: text };
}

function validateInteger(limit, value) {
  let number;
  if (typeof value === 'number') {
    number = value;
  } else if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    number = Number(value.trim());
  }
  if (!Number.isInteger(number) || number < limit.min || number > limit.max) {
    return { valid: false, message: `${limit.label} debe ser un número entero entre ${format(limit.min)} y ${format(limit.max)}.` };
  }
  return { valid: true, value: number };
}

/** Valida un valor para una clave. Devuelve `{ valid: true, value }` (ya normalizado) o `{ valid: false, message }`. */
export function validateSetting(key, value) {
  const limit = SETTING_LIMITS[key];
  if (!limit) {
    return { valid: false, message: 'Esa opción de configuración no existe.' };
  }
  return limit.type === 'text' ? validateText(limit, value) : validateInteger(limit, value);
}

/**
 * Valor vigente de una clave y de dónde viene: `saved` (guardado y válido), `environment` (configuración del servidor
 * y válida) o `default`. Un valor guardado inválido se ignora para no dejar una instalación sin funcionar.
 */
export function resolveSetting({ key, stored, envValue, defaultValue }) {
  if (stored !== undefined && stored !== null) {
    const saved = validateSetting(key, stored);
    if (saved.valid) {
      return { value: saved.value, source: 'saved' };
    }
  }
  if (envValue !== undefined && envValue !== null) {
    const fromEnvironment = validateSetting(key, envValue);
    if (fromEnvironment.valid) {
      return { value: fromEnvironment.value, source: 'environment' };
    }
  }
  return { value: defaultValue, source: 'default' };
}
