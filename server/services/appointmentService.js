import * as appointmentModel from '../models/appointmentModel.js';
import * as clientModel from '../models/clientModel.js';
import * as vehicleModel from '../models/vehicleModel.js';
import { AppError } from '../utils/AppError.js';

const EDITABLE_STATUSES = ['PENDIENTE', 'CONFIRMADA'];

function fieldError(field, message) {
  return AppError.validation(message, [{ field, message }]);
}

export async function listAppointments(filters) {
  const { items, total } = await appointmentModel.list(filters);
  return { data: items, page: filters.page, pageSize: filters.pageSize, total };
}

export async function getAppointment(id) {
  const appointment = await appointmentModel.findById(id);
  if (!appointment) {
    throw AppError.notFound('La cita no existe.');
  }
  return appointment;
}

// Una cita se asocia a un cliente activo y a un vehículo activo de ese mismo cliente.
export async function createAppointment(input, actor) {
  const client = await clientModel.findById(input.clientId);
  if (!client) {
    throw fieldError('clientId', 'El cliente indicado no existe.');
  }
  const vehicle = await vehicleModel.findById(input.vehicleId);
  if (!vehicle) {
    throw fieldError('vehicleId', 'El vehículo indicado no existe.');
  }
  if (vehicle.clientId !== client.id) {
    throw fieldError('vehicleId', 'El vehículo no pertenece al cliente indicado.');
  }
  if (!client.active) {
    throw AppError.conflict('El cliente está desactivado. Reactívalo antes de registrar una cita.');
  }
  if (!vehicle.active) {
    throw AppError.conflict('El vehículo está desactivado. Reactívalo antes de registrar una cita.');
  }
  await assertNoDuplicate(vehicle.id, input.scheduledAt);
  return appointmentModel.create({ ...input, createdBy: actor.id });
}

async function assertNoDuplicate(vehicleId, scheduledAt, excludeId = 0) {
  if (await appointmentModel.findActiveByVehicleAt(vehicleId, scheduledAt, excludeId)) {
    throw AppError.conflict('Ya existe una cita activa para este vehículo en esa fecha y hora.');
  }
}

// Solo se modifica mientras la cita esté PENDIENTE o CONFIRMADA; el cliente y el vehículo no cambian.
export async function updateAppointment(id, input) {
  const appointment = await getAppointment(id);
  if (!EDITABLE_STATUSES.includes(appointment.status)) {
    throw AppError.conflict(`La cita está en estado ${appointment.status} y ya no se puede modificar.`);
  }
  await assertNoDuplicate(appointment.vehicleId, input.scheduledAt, id);
  return appointmentModel.update(id, input);
}

// Confirma una cita pendiente.
export async function confirmAppointment(id) {
  const appointment = await getAppointment(id);
  if (appointment.status !== 'PENDIENTE') {
    throw AppError.conflict(`Solo se puede confirmar una cita PENDIENTE; esta está ${appointment.status}.`);
  }
  await appointmentModel.updateStatus(id, 'CONFIRMADA');
  return getAppointment(id);
}

// Cancela una cita pendiente o confirmada. Si ya tiene una orden, hay que cancelar primero la orden.
export async function cancelAppointment(id, { reason }) {
  const appointment = await getAppointment(id);
  if (appointment.orderId) {
    throw AppError.conflict(
      `La cita ya tiene la orden ${appointment.orderFolio} vinculada. Para cancelarla, cancela primero la orden.`
    );
  }
  if (!EDITABLE_STATUSES.includes(appointment.status)) {
    throw AppError.conflict(`Solo se puede cancelar una cita PENDIENTE o CONFIRMADA; esta está ${appointment.status}.`);
  }
  await appointmentModel.updateStatus(id, 'CANCELADA', reason);
  return getAppointment(id);
}
