import { AppError } from '../utils/AppError.js';
import {
  FieldErrors,
  isPlainObject,
  optionalLongText,
  parseId,
  parsePagination,
  requiredReason,
  requiredText,
  requireBody
} from './common.js';

export const MAINTENANCE_STATUSES = Object.freeze(['PROGRAMADO', 'ATENDIDO', 'CANCELADO']);
export const MAINTENANCE_VISUAL_STATUSES = Object.freeze(['NORMAL', 'PROXIMO', 'VENCIDO']);

const MAX_MILEAGE = 4294967295;
const has = (data, field) => Object.prototype.hasOwnProperty.call(data, field);

// Fecha real del calendario en formato AAAA-MM-DD (rechaza, por ejemplo, 2026-02-30).
function isCalendarDate(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return false;
  }
  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// Próximo mantenimiento: descripción y al menos una fecha objetivo o un kilometraje objetivo.
// Las reglas que dependen del día de hoy y del vehículo (fecha futura, kilometraje mayor al actual) las valida el servicio.
export function validateMaintenanceCreate(body) {
  const data = requireBody(body);
  const errors = new FieldErrors();

  const description = requiredText(errors, data, 'description', 'La descripción', 255);

  let dueDate = null;
  if (data.dueDate !== undefined && data.dueDate !== null && data.dueDate !== '') {
    if (typeof data.dueDate !== 'string' || !isCalendarDate(data.dueDate)) {
      errors.add('dueDate', 'La fecha debe tener el formato AAAA-MM-DD y existir en el calendario.');
    } else {
      dueDate = data.dueDate;
    }
  }

  let dueMileage = null;
  if (data.dueMileage !== undefined && data.dueMileage !== null && data.dueMileage !== '') {
    if (!Number.isInteger(data.dueMileage) || data.dueMileage < 1 || data.dueMileage > MAX_MILEAGE) {
      errors.add('dueMileage', 'El kilometraje objetivo debe ser un número entero mayor que cero.');
    } else {
      dueMileage = data.dueMileage;
    }
  }

  if (dueDate === null && dueMileage === null && !errors.items.some((e) => e.field === 'dueDate' || e.field === 'dueMileage')) {
    errors.add('dueDate', 'Indica una fecha, un kilometraje o ambos para programar el mantenimiento.');
  }

  const notes = optionalLongText(errors, data, 'notes', 'Las notas', 1000);
  errors.throwIfAny();
  return { description, dueDate, dueMileage, notes: notes === undefined ? null : notes };
}

// Atender un mantenimiento: el cuerpo es opcional; `orderId` indica la orden que lo cumplió.
export function validateFulfill(body) {
  if (body === undefined || body === null) {
    return { orderId: null };
  }
  const data = requireBody(body);
  if (!has(data, 'orderId') || data.orderId === null) {
    return { orderId: null };
  }
  const errors = new FieldErrors();
  if (!Number.isInteger(data.orderId) || data.orderId < 1) {
    errors.add('orderId', 'La orden no es válida.');
  }
  errors.throwIfAny();
  return { orderId: data.orderId };
}

// Cancelar un mantenimiento pendiente: el motivo es obligatorio.
export function validateCancel(body) {
  const data = requireBody(body);
  const errors = new FieldErrors();
  const reason = requiredReason(errors, data);
  errors.throwIfAny();
  return { reason };
}

function parseIdParam(value, label) {
  return value === undefined ? undefined : parseId(value, label);
}

// Filtros del listado: estado visual, ciclo de vida (PROGRAMADO por defecto), cliente, vehículo, búsqueda y paginación.
export function validateMaintenanceListQuery(query) {
  const source = isPlainObject(query) ? query : {};
  const { page, pageSize } = parsePagination(source);

  let visualStatus;
  if (source.visualStatus !== undefined) {
    if (!MAINTENANCE_VISUAL_STATUSES.includes(source.visualStatus)) {
      throw AppError.validation(`El parámetro visualStatus debe ser uno de: ${MAINTENANCE_VISUAL_STATUSES.join(', ')}.`);
    }
    visualStatus = source.visualStatus;
  }
  const status = source.status ?? 'PROGRAMADO';
  if (!MAINTENANCE_STATUSES.includes(status)) {
    throw AppError.validation(`El parámetro status debe ser uno de: ${MAINTENANCE_STATUSES.join(', ')}.`);
  }
  if (source.q !== undefined && (typeof source.q !== 'string' || source.q.length > 100)) {
    throw AppError.validation('El parámetro q debe ser texto de hasta 100 caracteres.');
  }
  return {
    visualStatus,
    status,
    clientId: parseIdParam(source.clientId, 'El cliente'),
    vehicleId: parseIdParam(source.vehicleId, 'El vehículo'),
    q: typeof source.q === 'string' ? source.q.trim() : '',
    page,
    pageSize
  };
}
