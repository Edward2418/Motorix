import { FieldErrors, requiredText, requireBody } from './common.js';

const MAX_MILEAGE = 4294967295;

// Entero positivo obligatorio (identificadores).
function positiveInt(errors, data, field, label) {
  const value = data[field];
  if (value === undefined || value === null || value === '') {
    errors.add(field, `${label} es obligatorio.`);
    return undefined;
  }
  if (!Number.isInteger(value) || value < 1) {
    errors.add(field, `${label} no es válido.`);
    return undefined;
  }
  return value;
}

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

// Reasignación de mecánico: { mechanicId }.
export function validateMechanicChange(body) {
  const data = requireBody(body);
  const errors = new FieldErrors();
  const mechanicId = positiveInt(errors, data, 'mechanicId', 'El mecánico');
  errors.throwIfAny();
  return { mechanicId };
}
