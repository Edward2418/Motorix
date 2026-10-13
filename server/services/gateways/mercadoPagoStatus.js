// Traduce los cobros que devuelve Mercado Pago a un estado de pago de Motorix. Módulo puro: sin red ni base de datos.

const REJECTED = new Set(['rejected', 'cancelled', 'refunded', 'charged_back']);

/**
 * results: cobros de la referencia externa, cada uno con { id, status }.
 * - PAGADO si algún cobro está aprobado (gana aunque otros estén rechazados).
 * - RECHAZADO si hay cobros y todos fueron rechazados, cancelados o devueltos.
 * - Sin cobros: RECHAZADO («expirado») si el enlace ya venció; PENDIENTE si sigue vigente.
 * - Cualquier otro caso (pending, in_process, authorized, in_mediation o un estado desconocido): PENDIENTE.
 * Devuelve { status, externalPaymentId, expired }.
 */
export function resolveStatus({ results, now, expiresAt }) {
  const approved = results.find((result) => result.status === 'approved');
  if (approved) {
    return { status: 'PAGADO', externalPaymentId: String(approved.id), expired: false };
  }
  if (results.length === 0) {
    const expired = expiresAt != null && now.getTime() > new Date(expiresAt).getTime();
    return { status: expired ? 'RECHAZADO' : 'PENDIENTE', externalPaymentId: null, expired };
  }
  if (results.every((result) => REJECTED.has(result.status))) {
    return { status: 'RECHAZADO', externalPaymentId: null, expired: false };
  }
  return { status: 'PENDIENTE', externalPaymentId: null, expired: false };
}
