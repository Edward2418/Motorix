import {
  FieldErrors,
  optionalText,
  parseDateOnly,
  parseDateTime,
  parseEnum,
  parseId,
  parsePagination,
  requiredPositiveInt,
  requiredText,
  requireBody
} from './common.js';

export const APPOINTMENT_STATUSES = Object.freeze(['PENDIENTE', 'CONFIRMADA', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA']);

// Margen de tolerancia hacia el pasado para compensar la diferencia entre relojes.
const PAST_TOLERANCE_MS = 5 * 60 * 1000;

// Fecha y hora de la cita: ISO 8601, sin fracciones de segundo y sin más de 5 minutos de antelación en el pasado.
function scheduledAtField(errors, data) {
  const date = parseDateTime(errors, data.scheduledAt, 'scheduledAt', 'La fecha y hora de la cita');
  if (date === undefined) {
    return undefined;
  }
  if (date.getTime() < Date.now() - PAST_TOLERANCE_MS) {
    errors.add('scheduledAt', 'La fecha y hora de la cita no pueden ser anteriores al momento actual.');
    return undefined;
  }
  return new Date(Math.floor(date.getTime() / 1000) * 1000);
}

// Alta de una cita: cliente, vehículo, fecha y hora, motivo y observaciones opcionales.
export function validateAppointmentCreate(body) {
  const data = requireBody(body);
  const errors = new FieldErrors();
  const clientId = requiredPositiveInt(errors, data, 'clientId', 'El cliente');
  const vehicleId = requiredPositiveInt(errors, data, 'vehicleId', 'El vehículo');
  const scheduledAt = scheduledAtField(errors, data);
  const reason = requiredText(errors, data, 'reason', 'El motivo', 255);
  const notes = optionalText(errors, data, 'notes', 'Las observaciones', 1000);
  errors.throwIfAny();
  return { clientId, vehicleId, scheduledAt, reason, notes };
}

// Modificación: fecha y hora, motivo y observaciones. El cliente y el vehículo no cambian.
export function validateAppointmentUpdate(body) {
  const data = requireBody(body);
  const errors = new FieldErrors();
  const scheduledAt = scheduledAtField(errors, data);
  const reason = requiredText(errors, data, 'reason', 'El motivo', 255);
  const notes = optionalText(errors, data, 'notes', 'Las observaciones', 1000);
  errors.throwIfAny();
  return { scheduledAt, reason, notes };
}

// Cancelación: el cuerpo es opcional y el motivo también (hasta 255 caracteres).
export function validateCancel(body) {
  const data = body === undefined || body === null ? {} : requireBody(body);
  const errors = new FieldErrors();
  const reason = optionalText(errors, data, 'reason', 'El motivo', 255);
  errors.throwIfAny();
  return { reason: reason ?? null };
}

export function validateAppointmentListQuery(query) {
  return {
    from: parseDateOnly(query.from, 'El filtro from'),
    to: parseDateOnly(query.to, 'El filtro to'),
    status: query.status === undefined ? undefined : parseEnum(query.status, APPOINTMENT_STATUSES, 'El estado'),
    clientId: query.clientId === undefined ? undefined : parseId(query.clientId, 'El filtro clientId'),
    ...parsePagination(query)
  };
}
