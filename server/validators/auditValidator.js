import { AppError } from '../utils/AppError.js';
import { AUDIT_ACTIONS } from '../services/auditService.js';

// Consulta de la bitácora: rango de fechas (AAAA-MM-DD, ambas incluidas), usuario, acción y paginación (50 por defecto,
// hasta 200 por página). Cualquier dato inválido responde 400 con el campo indicado.

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

function parseDate(errors, value, field, label) {
  if (value === undefined) {
    return undefined;
  }
  const match = typeof value === 'string' ? DATE_PATTERN.exec(value) : null;
  if (match) {
    const [, year, month, day] = match.map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
      return value;
    }
  }
  errors.push({ field, message: `${label} debe ser una fecha válida con el formato AAAA-MM-DD.` });
  return undefined;
}

function parsePositiveInt(errors, value, field, label, { min = 1, max = Number.MAX_SAFE_INTEGER, fallback } = {}) {
  if (value === undefined) {
    return fallback;
  }
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isInteger(number) || number < min || number > max) {
    errors.push({ field, message: `${label} debe ser un entero entre ${min} y ${max}.` });
    return fallback;
  }
  return number;
}

/** Devuelve los filtros listos para el modelo: `from` y `to` ya con la hora del inicio y del fin del día. */
export function validateAuditQuery(query) {
  const errors = [];
  const from = parseDate(errors, query.from, 'from', 'La fecha inicial');
  const to = parseDate(errors, query.to, 'to', 'La fecha final');
  if (from && to && from > to) {
    errors.push({ field: 'from', message: 'La fecha inicial no puede ser posterior a la final.' });
  }
  const userId = parsePositiveInt(errors, query.userId, 'userId', 'El usuario');
  let action;
  if (query.action !== undefined) {
    if (AUDIT_ACTIONS.includes(query.action)) {
      action = query.action;
    } else {
      errors.push({ field: 'action', message: `La acción debe ser una de: ${AUDIT_ACTIONS.join(', ')}.` });
    }
  }
  const page = parsePositiveInt(errors, query.page, 'page', 'La página', { fallback: 1 });
  const pageSize = parsePositiveInt(errors, query.pageSize, 'pageSize', 'El tamaño de página', {
    max: MAX_PAGE_SIZE,
    fallback: DEFAULT_PAGE_SIZE
  });
  if (errors.length > 0) {
    throw AppError.validation('Hay datos inválidos. Revisa los campos indicados.', errors);
  }
  return {
    from: from ? `${from} 00:00:00` : undefined,
    to: to ? `${to} 23:59:59` : undefined,
    userId,
    action,
    page,
    pageSize
  };
}
