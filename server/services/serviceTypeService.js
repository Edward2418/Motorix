import * as orderModel from '../models/orderModel.js';
import * as serviceTypeModel from '../models/serviceTypeModel.js';
import * as vehicleModel from '../models/vehicleModel.js';
import { AppError } from '../utils/AppError.js';
import { todayLocal } from './maintenanceService.js';
import { computeSuggestions } from './serviceTypeRules.js';

// Catálogo de tipos de servicio (Sprint 7): alta, edición, estado, listado y la propuesta de próximo mantenimiento.

const isDuplicate = (error) => error?.code === 'ER_DUP_ENTRY';

async function requireType(id) {
  const type = await serviceTypeModel.findById(id);
  if (!type) {
    throw AppError.notFound('El tipo de servicio no existe.');
  }
  return type;
}

export function listServiceTypes(filters) {
  return serviceTypeModel.list(filters);
}

export async function createServiceType(input) {
  try {
    return await serviceTypeModel.findById(await serviceTypeModel.insert(input));
  } catch (error) {
    throw isDuplicate(error) ? AppError.serviceTypeDuplicate() : error;
  }
}

export async function updateServiceType(id, input) {
  await requireType(id);
  try {
    await serviceTypeModel.update(id, input);
  } catch (error) {
    throw isDuplicate(error) ? AppError.serviceTypeDuplicate() : error;
  }
  return serviceTypeModel.findById(id);
}

export async function setServiceTypeActive(id, active) {
  await requireType(id);
  await serviceTypeModel.setActive(id, active);
  return serviceTypeModel.findById(id);
}

/**
 * Propuesta de próximo mantenimiento de una orden: una por cada tipo con intervalo ligado a sus líneas de servicio. La
 * pueden pedir ADMIN, RECEPTIONIST y el mecánico asignado a la orden (las mismas reglas que programar mantenimientos).
 */
export async function suggestionsForOrder(orderId, actor, { now = new Date() } = {}) {
  const order = await orderModel.findById(orderId);
  if (!order) {
    throw AppError.notFound('La orden no existe.');
  }
  if (actor.role === 'MECHANIC' && order.mechanicId !== actor.id) {
    throw AppError.forbidden('Solo el mecánico asignado puede consultar la propuesta de mantenimiento de esta orden.');
  }
  const [types, vehicle] = await Promise.all([serviceTypeModel.listForOrder(orderId), vehicleModel.findById(order.vehicleId)]);
  return computeSuggestions({
    types,
    today: todayLocal(now),
    serviceMileage: order.serviceMileage,
    currentMileage: vehicle?.currentMileage ?? 0
  });
}
