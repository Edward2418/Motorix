import * as settingModel from '../models/settingModel.js';
import { DEFAULT_SETTINGS, SETTING_KEYS, resolveSetting } from './settingsRules.js';

// Configuración del taller (Sprint 7): datos del taller y márgenes de «Próximo» del mantenimiento. Cada lectura consulta
// la tabla (cinco filas como máximo) sin caché, así un cambio se ve de inmediato y no hay estado obsoleto entre procesos.
// Valor vigente: guardado y válido → configuración del servidor (.env) → predeterminado.

// Nombre de la variable del servidor que corresponde a cada clave.
const ENV_NAMES = Object.freeze({
  workshop_name: 'WORKSHOP_NAME',
  workshop_address: 'WORKSHOP_ADDRESS',
  workshop_phone: 'WORKSHOP_PHONE',
  maintenance_soon_days: 'MAINTENANCE_SOON_DAYS',
  maintenance_soon_km: 'MAINTENANCE_SOON_KM'
});

/**
 * `model` y `env` se inyectan para poder probar el servicio con datos falsos. `env` es el objeto de variables de entorno
 * (se lee en cada consulta, no al arrancar).
 */
export function createSettingsService({ model = settingModel, env = process.env } = {}) {
  const envValue = (key) => {
    const raw = env[ENV_NAMES[key]];
    return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : undefined;
  };

  /** Todas las claves resueltas: `{ clave: { value, source } }`, y quién y cuándo se guardó la última. */
  async function resolveAll(conn) {
    const rows = await model.listAll(conn);
    const stored = new Map(rows.map((row) => [row.key, row.value]));
    const values = Object.fromEntries(
      SETTING_KEYS.map((key) => [
        key,
        resolveSetting({ key, stored: stored.get(key), envValue: envValue(key), defaultValue: DEFAULT_SETTINGS[key] })
      ])
    );
    const last = rows.reduce((newest, row) => (!newest || row.updatedAt > newest.updatedAt ? row : newest), null);
    return { values, updatedAt: last?.updatedAt ?? null, updatedByName: last?.updatedByName ?? null };
  }

  /** Datos del taller vigentes para el ticket: `{ name, address, phone }`. */
  async function getWorkshop(conn) {
    const { values } = await resolveAll(conn);
    return {
      name: values.workshop_name.value,
      address: values.workshop_address.value,
      phone: values.workshop_phone.value
    };
  }

  /** Márgenes de «Próximo» vigentes: `{ soonDays, soonKm }`. */
  async function getMaintenanceThresholds(conn) {
    const { values } = await resolveAll(conn);
    return { soonDays: values.maintenance_soon_days.value, soonKm: values.maintenance_soon_km.value };
  }

  return { resolveAll, getWorkshop, getMaintenanceThresholds };
}

export const settingsService = createSettingsService();
