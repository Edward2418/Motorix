import { AppError } from '../utils/AppError.js';

// Códigos de error de red o de MySQL que indican que la base de datos no está disponible.
const DB_UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'PROTOCOL_CONNECTION_LOST',
  'ER_ACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR',
  'ER_CON_COUNT_ERROR'
]);

function toResponse(error) {
  if (error instanceof AppError) {
    return { status: error.statusCode, code: error.code, message: error.message, details: error.details };
  }
  if (error?.type === 'entity.parse.failed') {
    return { status: 400, code: 'VALIDATION_ERROR', message: 'El cuerpo de la petición no es un JSON válido.' };
  }
  if (error?.code === 'ER_DUP_ENTRY') {
    return { status: 409, code: 'CONFLICT', message: 'Ya existe un registro con esos datos.' };
  }
  if (DB_UNAVAILABLE_CODES.has(error?.code)) {
    return {
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'El servicio no está disponible por el momento. Inténtalo de nuevo en unos minutos.'
    };
  }
  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'Ocurrió un error inesperado. Inténtalo de nuevo más tarde.'
  };
}

// Manejador central: nunca expone trazas ni detalles internos al usuario final.
// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, next) {
  const { status, code, message, details } = toResponse(error);
  if (status >= 500) {
    // El detalle técnico solo se registra en el servidor.
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}:`, error);
  }
  const body = { error: { code, message } };
  if (details) {
    body.error.details = details;
  }
  res.status(status).json(body);
}
