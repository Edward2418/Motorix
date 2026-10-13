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

  // Teléfono ya registrado en otro cliente activo: el cliente puede confirmar y guardar de todos modos.
  static phoneDuplicate(existingName) {
    const message = 'Ya existe un cliente activo con ese teléfono: ' + existingName + '.';
    return new AppError(409, 'PHONE_DUPLICATE', message, [{ field: 'phone', message }]);
  }

  static tooManyAttempts(message) {
    return new AppError(429, 'TOO_MANY_ATTEMPTS', message);
  }

  static notFound(message = 'El recurso solicitado no existe.') {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static conflict(message) {
    return new AppError(409, 'CONFLICT', message);
  }
}
