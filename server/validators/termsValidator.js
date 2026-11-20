import { AppError } from '../utils/AppError.js';
import { FieldErrors, parsePagination, requireBody } from './common.js';

// Cuerpo de POST /terms/accept: { version: entero >= 1 }.
export function validateTermsAccept(body) {
  const data = requireBody(body);
  const errors = new FieldErrors();
  if (!Number.isInteger(data.version) || data.version < 1) {
    errors.add('version', 'La versión debe ser un entero mayor o igual a 1.');
  }
  errors.throwIfAny();
  return { version: data.version };
}

function positiveInt(value, field, label) {
  if (value === undefined) {
    return undefined;
  }
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isInteger(number) || number < 1) {
    throw AppError.validation(`${label} debe ser un entero mayor o igual a 1.`, [
      { field, message: `${label} debe ser un entero mayor o igual a 1.` }
    ]);
  }
  return number;
}

// Consulta de aceptaciones: filtros por versión y usuario, y paginación (20 por defecto, hasta 100).
export function validateAcceptancesQuery(query) {
  return {
    version: positiveInt(query.version, 'version', 'La versión'),
    userId: positiveInt(query.userId, 'userId', 'El usuario'),
    ...parsePagination(query)
  };
}
