import * as clientModel from '../models/clientModel.js';
import * as vehicleModel from '../models/vehicleModel.js';
import { AppError } from '../utils/AppError.js';

export async function listClients(filters) {
  const { items, total } = await clientModel.list(filters);
  return { data: items, page: filters.page, pageSize: filters.pageSize, total };
}

// Devuelve el cliente con todos sus vehículos asociados (activos e inactivos).
export async function getClient(id) {
  const client = await clientModel.findById(id);
  if (!client) {
    throw AppError.notFound('El cliente no existe.');
  }
  const vehicles = await vehicleModel.listByClient(id);
  return { ...client, vehicles };
}

export function createClient(input) {
  return clientModel.create(input);
}

export async function updateClient(id, input) {
  await getClient(id);
  return clientModel.update(id, input);
}

// Desactiva o reactiva un cliente (baja lógica). No se puede desactivar mientras tenga vehículos activos.
export async function setClientStatus(id, active) {
  const client = await clientModel.findById(id);
  if (!client) {
    throw AppError.notFound('El cliente no existe.');
  }
  if (!active && client.active && (await vehicleModel.countActiveByClient(id)) > 0) {
    throw AppError.conflict(
      'No se puede desactivar al cliente porque tiene vehículos activos. Desactiva primero sus vehículos.'
    );
  }
  return clientModel.updateStatus(id, active);
}
