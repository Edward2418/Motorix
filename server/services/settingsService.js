import { withTransaction } from '../config/db.js';
import * as settingModel from '../models/settingModel.js';
import { DEFAULT_SETTINGS, SETTING_KEYS, resolveSetting } from './settingsRules.js';
import { auditService, looksLikeSecret } from './auditService.js';

// Nombre legible de cada dato para el detalle de la bitácora.
const AUDIT_LABELS = Object.freeze({
  workshop_name: 'nombre del taller',
  workshop_address: 'dirección del taller',
  workshop_phone: 'teléfono del taller',
  maintenance_soon_days: 'margen en días',
  maintenance_soon_km: 'margen en kilómetros'
});

// «dato: anterior → nuevo». Si el texto pareciera un secreto (por ejemplo un teléfono largo que se confunde con un
// número de tarjeta), solo se anota que el dato cambió: la bitácora nunca guarda ese tipo de valores.
function describeChange(key, previous, next) {
  const detail = `${AUDIT_LABELS[key]}: ${previous} → ${next}`;
  return looksLikeSecret(detail) ? `${AUDIT_LABELS[key]}: modificado` : detail;
}

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

const WORKSHOP_KEYS = ['workshop_name', 'workshop_address', 'workshop_phone'];
const MAINTENANCE_KEYS = ['maintenance_soon_days', 'maintenance_soon_km'];

// Origen de un grupo: `saved` si al menos un dato está guardado; si no, `environment` si alguno viene del servidor.
function groupSource(values, keys) {
  const sources = keys.map((key) => values[key].source);
  if (sources.includes('saved')) return 'saved';
  if (sources.includes('environment')) return 'environment';
  return 'default';
}

/**
 * `model` y `env` se inyectan para poder probar el servicio con datos falsos. `env` es el objeto de variables de entorno
 * (se lee en cada consulta, no al arrancar).
 */
export function createSettingsService({ model = settingModel, env = process.env, audit = auditService } = {}) {
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

  /** Configuración vigente con el origen de cada grupo, para la pantalla de Configuración (solo administración). */
  async function getView(conn) {
    const { values, updatedAt, updatedByName } = await resolveAll(conn);
    return {
      workshop: {
        name: values.workshop_name.value,
        address: values.workshop_address.value,
        phone: values.workshop_phone.value,
        source: groupSource(values, WORKSHOP_KEYS)
      },
      maintenance: {
        soonDays: values.maintenance_soon_days.value,
        soonKm: values.maintenance_soon_km.value,
        source: groupSource(values, MAINTENANCE_KEYS)
      },
      updatedAt,
      updatedByName
    };
  }

  /**
   * Guarda las entradas ya validadas (`[{ key, value }]`) en una sola transacción (todo o nada) y devuelve la
   * configuración vigente. Dos guardados simultáneos se serializan: gana el último y nunca se mezclan sus campos.
   */
  async function update(entries, actor) {
    await withTransaction(async (conn) => {
      const { values: before } = await resolveAll(conn);
      await model.saveMany(entries, actor.id, conn);
      // Un registro por cada dato que cambió de verdad (guardar el mismo valor no deja rastro), en la misma transacción.
      for (const { key, value } of entries) {
        const previous = before[key].value;
        if (String(previous) !== String(value)) {
          await audit.record(
            { userId: actor.id, actor: actor.username, action: 'SETTINGS_CHANGED', entity: 'SETTING', detail: describeChange(key, previous, value) },
            conn
          );
        }
      }
    });
    return getView();
  }

  return { resolveAll, getWorkshop, getMaintenanceThresholds, getView, update };
}

export const settingsService = createSettingsService();
