// Reglas puras de los pagos. Módulo sin acceso a la base de datos ni a la red: recibe números y decide.
// Los importes se manejan en centavos enteros para evitar errores de redondeo de los decimales.

export const PAYABLE_STATUSES = Object.freeze(['TERMINADO', 'ENTREGADO']);

export const toCents = (amount) => Math.round(Number(amount) * 100);
export const fromCents = (cents) => cents / 100;

/**
 * Resumen de pagos de una orden.
 * - collected: suma de pagos PAGADO.
 * - reserved: suma de pagos PENDIENTE (reservan su importe hasta resolverse).
 * - balance: lo que falta por cobrar (total menos cobrado).
 * - available: lo que todavía se puede registrar (saldo menos lo reservado).
 * - creditBalance: saldo a favor si el total bajó después de cobrar.
 * - status: PAGADA si lo cobrado alcanza el total (y el total es mayor que cero), SIN_PAGO si no hay nada cobrado,
 *   PARCIAL en otro caso. Los pagos RECHAZADO y CANCELADO no cuentan.
 */
export function summarize({ total, payments }) {
  const totalCents = toCents(total);
  let collected = 0;
  let reserved = 0;
  for (const payment of payments) {
    if (payment.status === 'PAGADO') {
      collected += toCents(payment.amount);
    } else if (payment.status === 'PENDIENTE') {
      reserved += toCents(payment.amount);
    }
  }
  const balance = Math.max(0, totalCents - collected);
  const available = Math.max(0, totalCents - collected - reserved);
  let status = 'PARCIAL';
  if (collected === 0) {
    status = 'SIN_PAGO';
  } else if (totalCents > 0 && collected >= totalCents) {
    status = 'PAGADA';
  }
  return {
    total: fromCents(totalCents),
    collected: fromCents(collected),
    reserved: fromCents(reserved),
    balance: fromCents(balance),
    available: fromCents(available),
    creditBalance: fromCents(Math.max(0, collected - totalCents)),
    status
  };
}

const formatMoney = (value) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Decide si se puede registrar un pago de `amount` sobre una orden. Devuelve { ok: true } o
 * { ok: false, code, reason, available? } con el código de error que debe responder el servicio.
 */
export function canRegister({ orderStatus, summary, amount }) {
  if (!PAYABLE_STATUSES.includes(orderStatus)) {
    return {
      ok: false,
      code: 'ORDER_NOT_PAYABLE',
      reason: `La orden está en estado ${orderStatus}: solo se cobra una orden terminada o entregada.`
    };
  }
  if (toCents(summary.total) <= 0) {
    return { ok: false, code: 'ORDER_NOT_PAYABLE', reason: 'La orden no tiene importe por cobrar.' };
  }
  if (toCents(amount) > toCents(summary.available)) {
    return {
      ok: false,
      code: 'AMOUNT_EXCEEDS_BALANCE',
      available: summary.available,
      reason: `El importe supera lo disponible para cobrar (${formatMoney(summary.available)}).`
    };
  }
  return { ok: true };
}
