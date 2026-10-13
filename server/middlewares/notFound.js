import { AppError } from '../utils/AppError.js';

export function notFound(req, res, next) {
  next(AppError.notFound('La ruta solicitada no existe.'));
}
