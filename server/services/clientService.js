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

// Avisa (409 PHONE_DUPLICATE) si otro cliente activo tiene el mismo teléfono, salvo que se confirme.
async function assertPhoneNotDuplicated({ phone, confirmDuplicate }, excludeId = 0) {
  if (confirmDuplicate) {
    return;
  }
  const existing = await clientModel.findActiveByPhoneDigits(phone, excludeId);
  if (existing) {
    throw AppError.phoneDuplicate(existing.name);
  }
}

export async function createClient(input) {
  await assertPhoneNotDuplicated(input);
  return clientModel.create(input);
}

export async function updateClient(id, input) {
  await getClient(id);
  await assertPhoneNotDuplicated(input, id);
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
