// Error controlado de la aplicación: lleva el código HTTP y un mensaje claro en español.
export class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static validation(message, details) {
    return new AppError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthenticated(message = 'Debes iniciar sesión para continuar.') {
    return new AppError(401, 'UNAUTHENTICATED', message);
  }

  static forbidden(message = 'No tienes permiso para realizar esta acción.') {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'El recurso solicitado no existe.') {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static conflict(message) {
    return new AppError(409, 'CONFLICT', message);
  }
}
