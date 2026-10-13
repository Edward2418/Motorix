import {
  FieldErrors,
  parseActiveFilter,
  parseId,
  parsePagination,
  parseSearch,
  requiredText,
  requireBody
} from './common.js';

const MIN_YEAR = 1950;
const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;
const PLATE_PATTERN = /^[A-Z0-9]{3,15}$/;

// Placa en mayúsculas y sin espacios ni guiones.
export function normalizePlate(value) {
  return value.toUpperCase().replace(/[\s-]/g, '');
}

// Datos de un vehículo nuevo: propietario, marca, modelo, año y placa obligatorios; VIN y kilometraje opcionales.
export function validateVehicleInput(body) {
  const data = requireBody(body);
  const errors = new FieldErrors();

  let clientId;
  if (data.clientId === undefined || data.clientId === null || data.clientId === '') {
    errors.add('clientId', 'El propietario es obligatorio.');
  } else if (!Number.isInteger(data.clientId) || data.clientId < 1) {
    errors.add('clientId', 'El propietario no es válido.');
  } else {
    clientId = data.clientId;
  }

  const brand = requiredText(errors, data, 'brand', 'La marca', 50);
  const model = requiredText(errors, data, 'model', 'El modelo', 50);

  let year;
  const maxYear = new Date().getFullYear() + 1;
  if (!Number.isInteger(data.year) || data.year < MIN_YEAR || data.year > maxYear) {
    errors.add('year', `El año debe ser un número entre ${MIN_YEAR} y ${maxYear}.`);
  } else {
    year = data.year;
  }

  let licensePlate;
  const rawPlate = requiredText(errors, data, 'licensePlate', 'La placa', 15);
  if (rawPlate !== undefined) {
    const normalized = normalizePlate(rawPlate);
    if (PLATE_PATTERN.test(normalized)) {
      licensePlate = normalized;
    } else {
      errors.add('licensePlate', 'La placa debe tener entre 3 y 15 letras o números.');
    }
  }

  let vin = null;
  if (data.vin !== undefined && data.vin !== null && String(data.vin).trim() !== '') {
    const normalizedVin = typeof data.vin === 'string' ? data.vin.trim().toUpperCase() : '';
    if (VIN_PATTERN.test(normalizedVin)) {
      vin = normalizedVin;
    } else {
      errors.add('vin', 'El VIN debe tener 17 caracteres alfanuméricos (sin las letras I, O ni Q).');
    }
  }

  let currentMileage = 0;
  if (data.currentMileage !== undefined && data.currentMileage !== null) {
    if (!Number.isInteger(data.currentMileage) || data.currentMileage < 0 || data.currentMileage > 4294967295) {
      errors.add('currentMileage', 'El kilometraje debe ser un número entero mayor o igual a 0.');
    } else {
      currentMileage = data.currentMileage;
    }
  }

  errors.throwIfAny();
  return { clientId, brand, model, year, licensePlate, vin, currentMileage };
}

export function validateVehicleListQuery(query) {
  return {
    search: parseSearch(query.search),
    active: parseActiveFilter(query.active),
    clientId: query.clientId === undefined ? undefined : parseId(query.clientId, 'El filtro clientId'),
    ...parsePagination(query)
  };
}
