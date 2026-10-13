import { FieldErrors, isPlainObject, optionalLongText, parseQuantity, requiredPositiveInt, requireBody } from './common.js';

// El motivo es opcional en la forma (el servicio lo exige cuando la administración modifica una orden TERMINADA).
function optionalReason(errors, data) {
  const reason = optionalLongText(errors, data, 'reason', 'El motivo', 255);
  return reason === undefined ? null : reason;
}

// Agregar una refacción a una orden: refacción y cantidad.
export function validateOrderPartAdd(body) {
  const data = requireBody(body);
  const errors = new FieldErrors();
  const partId = requiredPositiveInt(errors, data, 'partId', 'La refacción');
  const quantity = parseQuantity(errors, data.quantity, 'quantity', 'La cantidad');
  const reason = optionalReason(errors, data);
  errors.throwIfAny();
  return { partId, quantity, reason };
}

// Cambiar la cantidad de una refacción que ya está en la orden.
export function validateOrderPartQuantity(body) {
  const data = requireBody(body);
  const errors = new FieldErrors();
  const quantity = parseQuantity(errors, data.quantity, 'quantity', 'La cantidad');
  const reason = optionalReason(errors, data);
  errors.throwIfAny();
  return { quantity, reason };
}

// Quitar una refacción: el cuerpo es opcional (DELETE normalmente no lo trae).
export function validateOrderPartRemove(body) {
  if (body === undefined || body === null) {
    return { reason: null };
  }
  const data = isPlainObject(body) ? body : requireBody(body);
  const errors = new FieldErrors();
  const reason = optionalReason(errors, data);
  errors.throwIfAny();
  return { reason };
}
