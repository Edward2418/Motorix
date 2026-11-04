import { AppError } from '../utils/AppError.js';
import { toCents } from '../utils/money.js';
import { MAX_AMOUNT } from '../validators/common.js';

// Regla pura del límite del total de una orden. El máximo es el mismo de un importe individual (99,999,999.99), que
// también es lo que caben el pago (`payments.amount`) y el ticket (`tickets.order_total`), ambos DECIMAL(10,2).
export const MAX_ORDER_TOTAL_CENTS = toCents(MAX_AMOUNT);

// Rechaza (422) un cambio que haría pasar el total del máximo. `cambioCents` es lo que aumenta el total
// (negativo o cero si el cambio no lo aumenta, y entonces nunca se rechaza).
export function assertWithinLimit(totalActualCents, cambioCents) {
  if (cambioCents > 0 && totalActualCents + cambioCents > MAX_ORDER_TOTAL_CENTS) {
    throw AppError.orderTotalLimit();
  }
}
