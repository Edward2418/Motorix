import { FieldErrors, isPlainObject, requireBody } from './common.js';
import { validateSetting } from '../services/settingsRules.js';

// Cuerpo de PUT /settings: grupos con los campos que se quieren cambiar, por ejemplo
// { workshop: { name, address, phone } }. Se pueden mandar uno o varios campos; los demás conservan su valor. Un grupo
// o un campo desconocido se rechaza (no se ignora en silencio) y, si algún dato es inválido, no se guarda ninguno.

// Grupo → campo del cuerpo → clave guardada.
const GROUPS = Object.freeze({
  workshop: Object.freeze({ name: 'workshop_name', address: 'workshop_address', phone: 'workshop_phone' }),
  maintenance: Object.freeze({ soonDays: 'maintenance_soon_days', soonKm: 'maintenance_soon_km' })
});

/** Devuelve las entradas a guardar: `[{ key, value }]` con el valor ya normalizado. */
export function validateSettingsBody(body) {
  const data = requireBody(body);
  const errors = new FieldErrors();
  const entries = [];
  let groupsReceived = 0;

  for (const [group, fields] of Object.entries(data)) {
    const definition = GROUPS[group];
    if (!definition) {
      errors.add(group, 'No se reconoce ese grupo de configuración.');
      continue;
    }
    groupsReceived += 1;
    if (!isPlainObject(fields) || Object.keys(fields).length === 0) {
      errors.add(group, 'Indica al menos un dato de este grupo.');
      continue;
    }
    for (const [field, value] of Object.entries(fields)) {
      const key = definition[field];
      if (!key) {
        errors.add(`${group}.${field}`, 'No se reconoce ese dato de configuración.');
        continue;
      }
      const result = validateSetting(key, value);
      if (result.valid) {
        entries.push({ key, value: result.value });
      } else {
        errors.add(`${group}.${field}`, result.message);
      }
    }
  }

  if (groupsReceived === 0 && errors.items.length === 0) {
    errors.add('settings', `Indica al menos un grupo de configuración: ${Object.keys(GROUPS).join(', ')}.`);
  }
  errors.throwIfAny();
  return entries;
}
