import { AppError } from '../utils/AppError.js';
import { validateRange } from '../services/reportRules.js';

// Parámetros de los reportes: rango (`from` y `to`, obligatorios), formato (`json` por defecto o `csv`) y, en los
// reportes con lista, paginación (de 1 a 200 por página).
const FORMATS = ['json', 'csv'];

/** Devuelve `{ from, to, start, end, format }`; un rango o formato inválido lanza un 400 con el código que corresponde. */
export function validateReportQuery(query) {
  const range = validateRange(query.from, query.to);
  if (!range.ok) {
    if (range.code === 'REPORT_RANGE_INVALID') {
      throw AppError.reportRangeInvalid(range.message);
    }
    throw AppError.validation(range.message, [{ field: range.field, message: range.message }]);
  }
  const format = query.format ?? 'json';
  if (!FORMATS.includes(format)) {
    throw AppError.validation('El formato debe ser json o csv.', [{ field: 'format', message: 'El formato debe ser json o csv.' }]);
  }
  return { from: query.from, to: query.to, start: range.start, end: range.end, format };
}

/** Paginación de los reportes con lista: `page` desde 1 y `pageSize` de 1 a 200 (20 por defecto). */
export function validateReportPage(query) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const pageSize = query.pageSize === undefined ? 20 : Number(query.pageSize);
  if (!Number.isInteger(page) || page < 1) {
    throw AppError.validation('El parámetro page debe ser un entero mayor o igual a 1.', [{ field: 'page', message: 'El parámetro page debe ser un entero mayor o igual a 1.' }]);
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 200) {
    throw AppError.validation('El parámetro pageSize debe ser un entero entre 1 y 200.', [{ field: 'pageSize', message: 'El parámetro pageSize debe ser un entero entre 1 y 200.' }]);
  }
  return { page, pageSize };
}

