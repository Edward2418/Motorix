// Máquina de estados de las órdenes de servicio. Módulo puro: no accede a la base de datos.
// Recibe el estado actual, el destino y quién lo pide, y decide si el cambio es válido.

export const ORDER_STATUSES = Object.freeze([
  'RECIBIDO',
  'DIAGNOSTICO',
  'EN_REPARACION',
  'ESPERANDO_REFACCION',
  'TERMINADO',
  'ENTREGADO',
  'CANCELADA'
]);

// Transiciones válidas del flujo, sin importar el rol.
const FLOW = Object.freeze({
  RECIBIDO: ['DIAGNOSTICO', 'CANCELADA'],
  DIAGNOSTICO: ['EN_REPARACION', 'CANCELADA'],
  EN_REPARACION: ['ESPERANDO_REFACCION', 'TERMINADO', 'CANCELADA'],
  ESPERANDO_REFACCION: ['EN_REPARACION', 'CANCELADA'],
  TERMINADO: ['ENTREGADO'],
  ENTREGADO: [],
  CANCELADA: []
});

// Destinos que puede aplicar el mecánico asignado: nunca entrega ni cancela.
const MECHANIC_TARGETS = Object.freeze(['DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION', 'TERMINADO']);

const FINAL_STATUSES = Object.freeze(['ENTREGADO', 'CANCELADA']);

export function isFinalStatus(status) {
  return FINAL_STATUSES.includes(status);
}

// Una orden abierta ocupa al vehículo: cualquier estado que no sea ENTREGADO ni CANCELADA.
export function isOpenStatus(status) {
  return ORDER_STATUSES.includes(status) && !isFinalStatus(status);
}

function invalid(from, to) {
  if (isFinalStatus(from)) {
    return {
      ok: false,
      code: 'INVALID_TRANSITION',
      reason: `La orden está en estado ${from}, que es final y no admite más cambios.`
    };
  }
  const allowed = FLOW[from] ?? [];
  return {
    ok: false,
    code: 'INVALID_TRANSITION',
    reason: `No se puede pasar de ${from} a ${to}. Estados permitidos desde ${from}: ${allowed.join(', ')}.`
  };
}

function forbidden(message) {
  return { ok: false, code: 'FORBIDDEN', reason: message };
}

/**
 * Decide si un cambio de estado es válido para quien lo pide.
 * Orden de las comprobaciones: 1) un mecánico no asignado nunca puede (403); 2) la transición debe
 * existir en el flujo (409); 3) el mecánico asignado no puede entregar ni cancelar (403).
 */
export function canTransition({ from, to, role, isAssignedMechanic }) {
  if (role === 'MECHANIC' && !isAssignedMechanic) {
    return forbidden('Solo el mecánico asignado puede cambiar el estado de esta orden.');
  }
  if (!ORDER_STATUSES.includes(to)) {
    return { ok: false, code: 'INVALID_TRANSITION', reason: `El estado ${to} no existe.` };
  }
  if (!(FLOW[from] ?? []).includes(to)) {
    return invalid(from, to);
  }
  if (role === 'MECHANIC' && !MECHANIC_TARGETS.includes(to)) {
    return forbidden(
      to === 'ENTREGADO'
        ? 'Solo recepción o administración pueden marcar una orden como entregada.'
        : 'Solo recepción o administración pueden cancelar una orden.'
    );
  }
  if (role !== 'MECHANIC' && role !== 'ADMIN' && role !== 'RECEPTIONIST') {
    return forbidden('Tu rol no puede cambiar el estado de una orden.');
  }
  return { ok: true };
}

// Estados a los que el usuario puede llevar la orden desde `from` (para mostrar solo esas acciones).
export function allowedTransitions({ from, role, isAssignedMechanic }) {
  return (FLOW[from] ?? []).filter((to) => canTransition({ from, to, role, isAssignedMechanic }).ok);
}
