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

  // Transición de estado que el flujo no permite (409); el mensaje indica los estados permitidos.
  static invalidTransition(message) {
    return new AppError(409, 'INVALID_TRANSITION', message);
  }

  // No alcanza el stock para la salida pedida (409); el mensaje indica la existencia disponible.
  static insufficientStock(partName, available) {
    const unidades = available === 1 ? 'unidad' : 'unidades';
    return new AppError(409, 'INSUFFICIENT_STOCK', `No hay existencia suficiente de «${partName}»: disponible ${available} ${unidades}.`);
  }

  static partAlreadyInOrder() {
    return new AppError(409, 'PART_ALREADY_IN_ORDER', 'La refacción ya está en la orden. Modifica su cantidad en lugar de agregarla otra vez.');
  }

  static partInactive() {
    return new AppError(409, 'PART_INACTIVE', 'La refacción está desactivada y no puede agregarse a una orden.');
  }

  static duplicatePartCode() {
    const message = 'Ya existe una refacción con ese código.';
    return new AppError(409, 'DUPLICATE_PART_CODE', message, [{ field: 'code', message }]);
  }

  static duplicateMaintenance(existingId) {
    return new AppError(
      409,
      'DUPLICATE_MAINTENANCE',
      `Ya existe un mantenimiento pendiente con esa descripción para este vehículo (n.º ${existingId}).`
    );
  }

  static noAdjustmentNeeded() {
    return new AppError(409, 'NO_ADJUSTMENT_NEEDED', 'El stock contado coincide con el registrado: no hay nada que ajustar.');
  }

  // Pagos (Sprint 4)
  static orderNotPayable(reason) {
    return new AppError(409, 'ORDER_NOT_PAYABLE', reason);
  }

  static amountExceedsBalance(available) {
    const importe = `$${Number(available).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const message = `El importe supera lo disponible para cobrar (${importe}).`;
    return new AppError(409, 'AMOUNT_EXCEEDS_BALANCE', message, [{ field: 'amount', message }]);
  }

  static paymentNotCancellable(message = 'El pago ya no se puede cancelar.') {
    return new AppError(409, 'PAYMENT_NOT_CANCELLABLE', message);
  }

  static paymentNotRefreshable(message = 'Solo se puede actualizar el estado de un pago de Mercado Pago.') {
    return new AppError(409, 'PAYMENT_NOT_REFRESHABLE', message);
  }

  static mercadoPagoNotConfigured() {
    return new AppError(409, 'MERCADOPAGO_NOT_CONFIGURED', 'Mercado Pago no está configurado en el servidor.');
  }

  static orderNotTicketable(status) {
    return new AppError(
      409,
      'ORDER_NOT_TICKETABLE',
      `La orden está en estado ${status}: el ticket solo se genera para una orden terminada o entregada.`
    );
  }

  static ticketNotFound() {
    return new AppError(404, 'TICKET_NOT_FOUND', 'La orden todavía no tiene ticket.');
  }

  // Servicio externo (Mercado Pago) o base de datos caídos: 503 con mensaje propio, sin detalles internos.
  static serviceUnavailable(message = 'El servicio no está disponible por el momento. Inténtalo de nuevo en unos minutos.') {
    return new AppError(503, 'SERVICE_UNAVAILABLE', message);
  }

  static notFound(message = 'El recurso solicitado no existe.') {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static conflict(message) {
    return new AppError(409, 'CONFLICT', message);
  }
}
