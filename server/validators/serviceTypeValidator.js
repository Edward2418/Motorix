import { AppError } from '../utils/AppError.js';
import { validateServiceTypeInput } from '../services/serviceTypeRules.js';
import { requireBody, validateStatusBody } from './common.js';

/** Cuerpo de POST y PUT: `{ name, intervalDays?, intervalKm? }`. Devuelve el tipo normalizado o lanza un 400 con los campos. */
export function validateServiceTypeBody(body) {
  const { value, errors } = validateServiceTypeInput(requireBody(body));
  if (errors.length > 0) {
    throw AppError.validation('Hay datos inválidos. Revisa los campos indicados.', errors);
  }
  return value;
}

/** Filtro `active` del listado: `true`, `false` o ausente (todos). */
export function validateServiceTypeListQuery(query) {
  if (query.active === undefined) {
    return {};
  }
  if (query.active === 'true' || query.active === 'false') {
    return { active: query.active === 'true' };
  }
  throw AppError.validation('El parámetro active debe ser true o false.', [{ field: 'active', message: 'El parámetro active debe ser true o false.' }]);
}

export { validateStatusBody };
