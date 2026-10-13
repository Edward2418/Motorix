import { withTransaction } from '../config/db.js';
import * as appointmentModel from '../models/appointmentModel.js';
import * as clientModel from '../models/clientModel.js';
import * as orderHistoryModel from '../models/orderHistoryModel.js';
import * as orderItemModel from '../models/orderItemModel.js';
import * as orderModel from '../models/orderModel.js';
import * as userModel from '../models/userModel.js';
import * as vehicleModel from '../models/vehicleModel.js';
import { AppError } from '../utils/AppError.js';
import { nextFolio } from './folioService.js';
import { allowedTransitions, isFinalStatus } from './orderStateMachine.js';

const formatKm = (km) => Number(km).toLocaleString('en-US');

function fieldError(field, message) {
  return AppError.validation(message, [{ field, message }]);
}

// Detalle completo de la orden: líneas, totales, historial y las transiciones que el actor puede hacer.
export async function buildOrderDetail(order, actor, conn) {
  const [services, labor, history] = await Promise.all([
    orderItemModel.listServices(order.id, conn),
    orderItemModel.listLabor(order.id, conn),
    orderHistoryModel.listByOrder(order.id, conn)
  ]);
  return {
    ...order,
    services,
    labor,
    history,
    allowedTransitions: allowedTransitions({
      from: order.status,
      role: actor.role,
      isAssignedMechanic: order.mechanicId === actor.id
    })
  };
}

// Valida que el usuario sea un mecánico activo.
async function requireActiveMechanic(mechanicId) {
  const mechanic = await userModel.findById(mechanicId);
  if (!mechanic || !mechanic.active || mechanic.role !== 'MECHANIC') {
    throw fieldError('mechanicId', 'El mecánico indicado no existe, está desactivado o no tiene el rol de mecánico.');
  }
  return mechanic;
}

// Decide el kilometraje de entrada frente al registrado del vehículo (RN-3 y RN-4).
function checkMileage(input, vehicle, actor) {
  const previous = vehicle.current_mileage;
  const lower = input.entryMileage < previous;
  if (input.correctMileage && !lower) {
    throw fieldError('correctMileage', 'La corrección de kilometraje solo aplica cuando el kilometraje de entrada es menor al registrado.');
  }
  if (lower) {
    if (!input.correctMileage) {
      throw fieldError(
        'entryMileage',
        `El kilometraje de entrada no puede ser menor al registrado del vehículo (${formatKm(previous)} km).`
      );
    }
    if (actor.role !== 'ADMIN') {
      throw AppError.forbidden('Solo un administrador puede corregir el kilometraje a la baja.');
    }
  }
  return previous;
}

// Valida la cita de origen y la deja EN_PROCESO (dentro de la transacción de la orden).
async function linkAppointment(input, conn) {
  const appointment = await appointmentModel.lockById(input.appointmentId, conn);
  if (!appointment) {
    throw fieldError('appointmentId', 'La cita indicada no existe.');
  }
  if (appointment.client_id !== input.clientId || appointment.vehicle_id !== input.vehicleId) {
    throw fieldError('appointmentId', 'La cita no corresponde al cliente y al vehículo indicados.');
  }
  if (!['PENDIENTE', 'CONFIRMADA'].includes(appointment.status)) {
    throw AppError.conflict(
      `La cita está en estado ${appointment.status} y no se puede usar para crear una orden.`
    );
  }
  await appointmentModel.updateStatus(appointment.id, 'EN_PROCESO', null, conn);
}

// Crea la orden en una sola transacción: valida, genera el folio, guarda la orden y su historial,
// actualiza el kilometraje del vehículo y, si hay cita, la pasa a EN_PROCESO.
export async function createOrder(input, actor) {
  const orderId = await withTransaction(async (conn) => {
    const vehicle = await vehicleModel.lockById(input.vehicleId, conn);
    if (!vehicle) {
      throw fieldError('vehicleId', 'El vehículo indicado no existe.');
    }
    const client = await clientModel.findById(input.clientId);
    if (!client) {
      throw fieldError('clientId', 'El cliente indicado no existe.');
    }
    if (vehicle.client_id !== client.id) {
      throw fieldError('vehicleId', 'El vehículo no pertenece al cliente indicado.');
    }
    if (!client.active) {
      throw AppError.conflict('El cliente está desactivado. Reactívalo antes de crear una orden.');
    }
    if (!vehicle.active) {
      throw AppError.conflict('El vehículo está desactivado. Reactívalo antes de crear una orden.');
    }
    await requireActiveMechanic(input.mechanicId);

    const open = await orderModel.findOpenByVehicle(vehicle.id, conn);
    if (open) {
      throw AppError.conflict(`El vehículo ya tiene una orden abierta (${open.folio}). Entrégala o cancélala primero.`);
    }

    const previousMileage = checkMileage(input, vehicle, actor);
    if (input.appointmentId) {
      await linkAppointment(input, conn);
    }

    const folio = await nextFolio(conn);
    const id = await orderModel.insert(
      {
        folio,
        clientId: client.id,
        vehicleId: vehicle.id,
        mechanicId: input.mechanicId,
        appointmentId: input.appointmentId,
        entryMileage: input.entryMileage,
        previousMileage,
        mileageCorrectionReason: input.correctMileage ? input.mileageCorrectionReason : null,
        reportedProblem: input.reportedProblem,
        createdBy: actor.id
      },
      conn
    );
    await orderHistoryModel.insert({ orderId: id, fromStatus: null, toStatus: 'RECIBIDO', changedBy: actor.id }, conn);
    await vehicleModel.updateMileage(vehicle.id, input.entryMileage, conn);
    return id;
  }).catch(async (error) => {
    // Respaldo: si dos peticiones chocan, la base de datos impide la segunda orden abierta.
    if (error?.code === 'ER_DUP_ENTRY' && String(error.message).includes('uq_orders_open_vehicle')) {
      const open = await orderModel.findOpenByVehicle(input.vehicleId);
      throw AppError.conflict(
        `El vehículo ya tiene una orden abierta${open ? ` (${open.folio})` : ''}. Entrégala o cancélala primero.`
      );
    }
    throw error;
  });

  return buildOrderDetail(await orderModel.findById(orderId), actor);
}

// Consulta una orden. Un mecánico solo puede abrir las que tiene asignadas.
export async function getOrder(id, actor) {
  const order = await orderModel.findById(id);
  if (!order) {
    throw AppError.notFound('La orden no existe.');
  }
  if (actor.role === 'MECHANIC' && order.mechanicId !== actor.id) {
    throw AppError.forbidden('Esta orden está asignada a otro mecánico.');
  }
  return buildOrderDetail(order, actor);
}

// Reasigna el mecánico mientras la orden no sea final (ENTREGADO o CANCELADA).
export async function reassignMechanic(orderId, mechanicId, actor) {
  const order = await orderModel.findById(orderId);
  if (!order) {
    throw AppError.notFound('La orden no existe.');
  }
  if (isFinalStatus(order.status)) {
    throw AppError.conflict(`La orden está ${order.status} y ya no se puede reasignar.`);
  }
  await requireActiveMechanic(mechanicId);
  await orderModel.updateMechanic(orderId, mechanicId);
  return buildOrderDetail(await orderModel.findById(orderId), actor);
}
