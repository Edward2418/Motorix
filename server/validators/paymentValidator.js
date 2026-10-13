import { FieldErrors, optionalText, parseAmount, requireBody, requiredReason } from './common.js';

export const PAYMENT_METHODS = Object.freeze(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'MERCADO_PAGO']);

// Cuerpo de un pago nuevo. Solo se leen importe, método y referencia: cualquier otro campo se ignora.
export function validatePaymentCreate(body) {
  const data = requireBody(body);
  const errors = new FieldErrors();

  let amount = parseAmount(errors, data.amount, 'amount', 'El importe');
  if (amount !== undefined && amount <= 0) {
    errors.add('amount', 'El importe debe ser mayor que cero.');
    amount = undefined;
  }

  let method;
  if (typeof data.method !== 'string' || !PAYMENT_METHODS.includes(data.method)) {
    errors.add('method', `El método de pago debe ser uno de: ${PAYMENT_METHODS.join(', ')}.`);
  } else {
    method = data.method;
  }

  const reference = optionalText(errors, data, 'reference', 'La referencia', 100);

  errors.throwIfAny();
  return { amount, method, reference };
}

// Cancelación de un pago: el motivo es obligatorio.
export function validatePaymentCancel(body) {
  const data = requireBody(body);
  const errors = new FieldErrors();
  const reason = requiredReason(errors, data);
  errors.throwIfAny();
  return { reason };
}
