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
import { allowedTransitions, canTransition, isFinalStatus } from './orderStateMachine.js';

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

// Lista órdenes. Un mecánico solo ve las asignadas a él, sin importar los filtros que envíe.
export async function listOrders(filters, actor) {
  const effective = actor.role === 'MECHANIC' ? { ...filters, mechanicId: actor.id } : filters;
  const { items, total } = await orderModel.list(effective);
  return { data: items.map(orderModel.toSummary), page: filters.page, pageSize: filters.pageSize, total };
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

// El kilometraje del servicio no puede ser menor al de entrada de la orden.
function assertServiceMileage(serviceMileage, entryMileage) {
  if (serviceMileage < entryMileage) {
    throw fieldError(
      'serviceMileage',
      `El kilometraje del servicio no puede ser menor al de entrada (${formatKm(entryMileage)} km).`
    );
  }
}

// Corrige el kilometraje del servicio de una orden TERMINADO o ENTREGADO (solo ADMIN, con motivo obligatorio).
// No cambia el kilometraje actual del vehículo.
export async function correctServiceMileage(orderId, { serviceMileage, reason }, actor) {
  if (actor.role !== 'ADMIN') {
    throw AppError.forbidden('Solo un administrador puede corregir el kilometraje del servicio.');
  }
  await withTransaction(async (conn) => {
    const order = await orderModel.lockById(orderId, conn);
    if (!order) {
      throw AppError.notFound('La orden no existe.');
    }
    if (order.status !== 'TERMINADO' && order.status !== 'ENTREGADO') {
      throw AppError.conflict(
        `La orden está en estado ${order.status}: el kilometraje del servicio solo se corrige en órdenes terminadas o entregadas.`
      );
    }
    assertServiceMileage(serviceMileage, order.entry_mileage);
    await orderModel.setServiceMileage(orderId, serviceMileage, { reason, correctedBy: actor.id }, conn);
  });
  return buildOrderDetail(await orderModel.findById(orderId), actor);
}

// Cambia el estado de la orden dentro de una transacción: bloquea la orden, valida la transición y el rol,
// guarda el cambio (solo si el estado sigue siendo el leído), registra el historial y actualiza la cita vinculada.
export async function changeStatus(id, { status, reason, serviceMileage }, actor) {
  await withTransaction(async (conn) => {
    const order = await orderModel.lockById(id, conn);
    if (!order) {
      throw AppError.notFound('La orden no existe.');
    }
    const check = canTransition({
      from: order.status,
      to: status,
      role: actor.role,
      isAssignedMechanic: order.mechanic_id === actor.id
    });
    if (!check.ok) {
      throw check.code === 'FORBIDDEN' ? AppError.forbidden(check.reason) : AppError.invalidTransition(check.reason);
    }

    // Para terminar la orden hace falta el kilometraje del servicio (se comprueba después del permiso y la transición).
    if (status === 'TERMINADO') {
      if (serviceMileage === null || serviceMileage === undefined) {
        throw fieldError('serviceMileage', 'El kilometraje del servicio es obligatorio para terminar la orden.');
      }
      assertServiceMileage(serviceMileage, order.entry_mileage);
    }

    const applied = await orderModel.updateStatus(
      id,
      order.status,
      status,
      {
        cancelReason: status === 'CANCELADA' ? reason : null,
        deliveredAt: status === 'ENTREGADO' ? new Date() : null,
        serviceMileage: status === 'TERMINADO' ? serviceMileage : null
      },
      conn
    );
    if (!applied) {
      throw AppError.conflict('El estado de la orden cambió mientras se procesaba tu solicitud. Vuelve a intentarlo.');
    }
    await orderHistoryModel.insert(
      { orderId: id, fromStatus: order.status, toStatus: status, changedBy: actor.id, reason: status === 'CANCELADA' ? reason : null },
      conn
    );
    if (status === 'TERMINADO') {
      // El kilometraje actual del vehículo solo sube; nunca baja.
      await vehicleModel.raiseMileage(order.vehicle_id, serviceMileage, conn);
    }

    if (order.appointment_id) {
      if (status === 'ENTREGADO') {
        await appointmentModel.updateStatus(order.appointment_id, 'COMPLETADA', null, conn);
      } else if (status === 'CANCELADA') {
        await appointmentModel.updateStatus(order.appointment_id, 'CANCELADA', reason, conn);
      }
    }
  });
  return buildOrderDetail(await orderModel.findById(id), actor);
}

// ---------- Edición del contenido y de las líneas (FR-016, FR-017 y FR-017a) ----------

const TECHNICAL_FIELDS = ['diagnosis', 'notes', 'recommendations'];
// En TERMINADO solo se pueden agregar observaciones y recomendaciones.
const TERMINADO_FIELDS = ['notes', 'recommendations'];

const isAssignedMechanic = (order, actor) => actor.role === 'MECHANIC' && order.mechanicId === actor.id;

// Contenido técnico y líneas: el mecánico asignado o un administrador.
const canEditTechnical = (order, actor) => actor.role === 'ADMIN' || isAssignedMechanic(order, actor);

// El problema reportado lo editan recepción y administración.
const canEditReportedProblem = (actor) => actor.role === 'ADMIN' || actor.role === 'RECEPTIONIST';

async function requireOrder(id, conn) {
  const order = await orderModel.findById(id, conn);
  if (!order) {
    throw AppError.notFound('La orden no existe.');
  }
  return order;
}

// Líneas editables mientras la orden no esté TERMINADO, ENTREGADO ni CANCELADA.
function assertLinesEditable(order) {
  if (order.status === 'TERMINADO' || isFinalStatus(order.status)) {
    throw AppError.conflict(`La orden está en estado ${order.status} y ya no admite cambios en servicios ni mano de obra.`);
  }
}

// Actualiza solo los campos enviados, validando permisos (403) y estado (409) de cada uno.
export async function updateContent(id, fields, actor) {
  const order = await requireOrder(id);
  const keys = Object.keys(fields);

  for (const key of keys) {
    const allowed = key === 'reportedProblem' ? canEditReportedProblem(actor) : canEditTechnical(order, actor);
    if (!allowed) {
      throw AppError.forbidden(
        key === 'reportedProblem'
          ? 'Solo recepción o administración pueden editar el problema reportado.'
          : 'Solo el mecánico asignado o un administrador pueden editar este contenido.'
      );
    }
  }

  const editableByState = (key) => {
    if (isFinalStatus(order.status)) {
      return false;
    }
    return order.status === 'TERMINADO' ? TERMINADO_FIELDS.includes(key) : true;
  };
  const blocked = keys.filter((key) => !editableByState(key));
  if (blocked.length > 0) {
    throw AppError.conflict(
      `La orden está en estado ${order.status} y no admite cambios en: ${blocked.join(', ')}.`
    );
  }

  await orderModel.updateContent(id, fields);
  return buildOrderDetail(await orderModel.findById(id), actor);
}

async function loadEditableOrder(orderId, actor) {
  const order = await requireOrder(orderId);
  if (!canEditTechnical(order, actor)) {
    throw AppError.forbidden('Solo el mecánico asignado o un administrador pueden modificar servicios y mano de obra.');
  }
  assertLinesEditable(order);
  return order;
}

// Agrega un servicio (kind = 'services') o una línea de mano de obra (kind = 'labor').
export async function addLine(kind, orderId, input, actor) {
  await loadEditableOrder(orderId, actor);
  await orderItemModel.insertLine(kind, orderId, input);
  return buildOrderDetail(await orderModel.findById(orderId), actor);
}

export async function updateLine(kind, orderId, lineId, input, actor) {
  await loadEditableOrder(orderId, actor);
  if (!(await orderItemModel.findLine(kind, orderId, lineId))) {
    throw AppError.notFound('La línea no existe en esta orden.');
  }
  await orderItemModel.updateLine(kind, orderId, lineId, input);
  return buildOrderDetail(await orderModel.findById(orderId), actor);
}

// Quita solo la línea; la orden nunca se elimina.
export async function removeLine(kind, orderId, lineId, actor) {
  await loadEditableOrder(orderId, actor);
  if (!(await orderItemModel.findLine(kind, orderId, lineId))) {
    throw AppError.notFound('La línea no existe en esta orden.');
  }
  await orderItemModel.deleteLine(kind, orderId, lineId);
  return buildOrderDetail(await orderModel.findById(orderId), actor);
}
