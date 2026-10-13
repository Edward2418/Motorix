import * as clientModel from '../models/clientModel.js';
import * as vehicleModel from '../models/vehicleModel.js';
import { AppError } from '../utils/AppError.js';

export async function listVehicles(filters) {
  const { items, total } = await vehicleModel.list(filters);
  return { data: items, page: filters.page, pageSize: filters.pageSize, total };
}

export async function getVehicle(id) {
  const vehicle = await vehicleModel.findById(id);
  if (!vehicle) {
    throw AppError.notFound('El vehículo no existe.');
  }
  return vehicle;
}

// Traduce un duplicado de MySQL (por carrera entre dos peticiones) al mensaje correspondiente.
function duplicateError(error) {
  if (error?.code !== 'ER_DUP_ENTRY') {
    return error;
  }
  return error.message.includes('uq_vehicles_vin')
    ? AppError.conflict('Ya existe un vehículo registrado con ese VIN.')
    : AppError.conflict('Ya existe un vehículo registrado con esa placa.');
}

// Un vehículo siempre pertenece a un cliente existente y activo; la placa (y el VIN, si se indica) son únicos.
export async function createVehicle(input) {
  const owner = await clientModel.findById(input.clientId);
  if (!owner) {
    throw AppError.validation('El propietario indicado no existe.', [
      { field: 'clientId', message: 'El propietario indicado no existe.' }
    ]);
  }
  if (!owner.active) {
    throw AppError.conflict('El propietario está desactivado. Reactívalo antes de registrar vehículos.');
  }
  if (await vehicleModel.findByPlate(input.licensePlate)) {
    throw AppError.conflict('Ya existe un vehículo registrado con esa placa.');
  }
  if (input.vin && (await vehicleModel.findByVin(input.vin))) {
    throw AppError.conflict('Ya existe un vehículo registrado con ese VIN.');
  }
  try {
    return await vehicleModel.create(input);
  } catch (error) {
    throw duplicateError(error);
  }
}

// Desactiva o reactiva un vehículo (baja lógica). Reactivar exige que el propietario esté activo.
export async function setVehicleStatus(id, active) {
  const vehicle = await getVehicle(id);
  if (active && !vehicle.active) {
    const owner = await clientModel.findById(vehicle.clientId);
    if (!owner?.active) {
      throw AppError.conflict('No se puede reactivar el vehículo porque su propietario está desactivado.');
    }
  }
  return vehicleModel.updateStatus(id, active);
}
