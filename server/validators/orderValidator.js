import { ORDER_STATUSES } from '../services/orderStateMachine.js';
import {
  FieldErrors,
  optionalLongText,
  parseAmount,
  parseEnum,
  parseId,
  parsePagination,
  parseSearch,
  requiredPositiveInt as positiveInt,
  requiredText,
  requireBody
} from './common.js';

const MAX_MILEAGE = 4294967295;

// Datos de una orden nueva: cliente, vehículo, mecánico, kilometraje de entrada y problema reportado.
// La corrección de kilometraje (solo ADMIN, lo valida el servicio) exige un motivo.
export function validateOrderCreate(body) {
  const data = requireBody(body);
  const errors = new FieldErrors();

  const clientId = positiveInt(errors, data, 'clientId', 'El cliente');
  const vehicleId = positiveInt(errors, data, 'vehicleId', 'El vehículo');
  const mechanicId = positiveInt(errors, data, 'mechanicId', 'El mecánico');

  let appointmentId = null;
  if (data.appointmentId !== undefined && data.appointmentId !== null) {
    if (!Number.isInteger(data.appointmentId) || data.appointmentId < 1) {
      errors.add('appointmentId', 'La cita no es válida.');
    } else {
      appointmentId = data.appointmentId;
    }
  }

  let entryMileage;
  if (!Number.isInteger(data.entryMileage) || data.entryMileage < 0 || data.entryMileage > MAX_MILEAGE) {
    errors.add('entryMileage', 'El kilometraje de entrada es obligatorio y debe ser un número entero mayor o igual a 0.');
  } else {
    entryMileage = data.entryMileage;
  }

  const reportedProblem = requiredText(errors, data, 'reportedProblem', 'El problema reportado', 2000);

  let correctMileage = false;
  let mileageCorrectionReason = null;
  if (data.correctMileage !== undefined && data.correctMileage !== null) {
    if (typeof data.correctMileage !== 'boolean') {
      errors.add('correctMileage', 'correctMileage debe ser verdadero o falso.');
    } else {
      correctMileage = data.correctMileage;
    }
  }
  if (correctMileage) {
    mileageCorrectionReason = requiredText(
      errors,
      data,
      'mileageCorrectionReason',
      'El motivo de la corrección de kilometraje',
      255
    );
  }

  errors.throwIfAny();
  return {
    clientId,
    vehicleId,
    mechanicId,
    appointmentId,
    entryMileage,
    reportedProblem,
    correctMileage,
    mileageCorrectionReason
  };
}

// Filtros del listado: estado, mecánico, cliente, búsqueda y paginación.
export function validateOrderListQuery(query) {
  return {
    status: query.status === undefined ? undefined : parseEnum(query.status, ORDER_STATUSES, 'El estado'),
    mechanicId: query.mechanicId === undefined ? undefined : parseId(query.mechanicId, 'El filtro mechanicId'),
    clientId: query.clientId === undefined ? undefined : parseId(query.clientId, 'El filtro clientId'),
    search: parseSearch(query.search),
    ...parsePagination(query)
  };
}

// Reasignación de mecánico: { mechanicId }.
export function validateMechanicChange(body) {
  const data = requireBody(body);
  const errors = new FieldErrors();
  const mechanicId = positiveInt(errors, data, 'mechanicId', 'El mecánico');
  errors.throwIfAny();
  return { mechanicId };
}

// Edición del contenido de la orden: solo se validan y devuelven los campos enviados.
// El problema reportado es obligatorio si se envía; los demás se guardan como null cuando vienen vacíos.
export function validateOrderContent(body) {
  const data = requireBody(body);
  const errors = new FieldErrors();
  const fields = {};

  if (Object.prototype.hasOwnProperty.call(data, 'reportedProblem')) {
    fields.reportedProblem = requiredText(errors, data, 'reportedProblem', 'El problema reportado', 2000);
  }
  for (const [field, label] of [
    ['diagnosis', 'El diagnóstico'],
    ['notes', 'Las observaciones'],
    ['recommendations', 'Las recomendaciones']
  ]) {
    const value = optionalLongText(errors, data, field, label, 4000);
    if (value !== undefined) {
      fields[field] = value;
    }
  }

  if (Object.keys(fields).length === 0 && errors.items.length === 0) {
    errors.add('body', 'Envía al menos uno de estos campos: reportedProblem, diagnosis, notes, recommendations.');
  }
  errors.throwIfAny();
  return fields;
}

// Cambio de estado: el estado destino y, para la cancelación, un motivo obligatorio.
export function validateStatusChange(body) {
  const data = requireBody(body);
  const errors = new FieldErrors();
  if (typeof data.status !== 'string' || !ORDER_STATUSES.includes(data.status)) {
    errors.add('status', `El estado debe ser uno de: ${ORDER_STATUSES.join(', ')}.`);
  }
  let reason = optionalLongText(errors, data, 'reason', 'El motivo', 255);
  reason = reason === undefined ? null : reason;
  if (data.status === 'CANCELADA' && reason === null) {
    errors.add('reason', 'El motivo de la cancelación es obligatorio.');
  }
  errors.throwIfAny();
  return { status: data.status, reason: data.status === 'CANCELADA' ? reason : null };
}

// Servicio o línea de mano de obra: descripción e importe (en la API siempre se llama `amount`).
export function validateLine(body) {
  const data = requireBody(body);
  const errors = new FieldErrors();
  const description = requiredText(errors, data, 'description', 'La descripción', 255);
  const amount = parseAmount(errors, data.amount, 'amount', 'El importe');
  errors.throwIfAny();
  return { description, amount };
}
