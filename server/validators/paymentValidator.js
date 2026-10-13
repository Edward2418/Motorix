import { FieldErrors, optionalText, parseAmount, requireBody, requiredReason } from './common.js';

const CARD_NUMBER_MESSAGE =
  'No escribas números de tarjeta: usa solo un número de autorización o de rastreo.';

// Validación de Luhn: la usan todas las tarjetas de pago, así que un número que la pase se trata como tarjeta.
function passesLuhn(digits) {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let value = Number(digits[i]);
    if (double) {
      value *= 2;
      if (value > 9) {
        value -= 9;
      }
    }
    sum += value;
    double = !double;
  }
  return sum % 10 === 0;
}

// La referencia es un número de autorización o de rastreo, nunca un número de tarjeta (RN-14).
// Devuelve { value, error }: value es el texto recortado (o null si está vacío).
export function validateReference(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    return { value: null, error: null };
  }
  const value = text.trim();
  const compact = value.replace(/[\s-]/g, '');
  if (/^\d{13,19}$/.test(compact) && passesLuhn(compact)) {
    return { value, error: CARD_NUMBER_MESSAGE };
  }
  return { value, error: null };
}

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

  let reference = optionalText(errors, data, 'reference', 'La referencia', 100);
  if (typeof reference === 'string') {
    const checked = validateReference(reference);
    if (checked.error) {
      errors.add('reference', checked.error);
      reference = undefined;
    }
  }

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
