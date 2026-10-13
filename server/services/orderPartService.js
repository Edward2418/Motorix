import { withTransaction } from '../config/db.js';
import * as inventoryMovementModel from '../models/inventoryMovementModel.js';
import * as orderModel from '../models/orderModel.js';
import * as orderPartModel from '../models/orderPartModel.js';
import * as partModel from '../models/partModel.js';
import { AppError } from '../utils/AppError.js';
import { translateRuleError } from './inventoryService.js';
import { buildOrderDetail } from './orderService.js';
import { applyDelta } from './stockRules.js';

// Refacciones usadas en una orden. Cada cambio mueve el inventario en la misma transacción:
// agregar o aumentar genera una SALIDA; reducir, quitar o cancelar la orden genera una ENTRADA de devolución.

const MAX_REASON = 255;

const clip = (text) => (text.length > MAX_REASON ? `${text.slice(0, MAX_REASON - 1)}…` : text);
const withMotive = (base, reason) => clip(reason ? `${base} · Motivo: ${reason}` : base);

// Quién puede modificar refacciones y cuándo. Orden de las comprobaciones: rol (403), propiedad (403),
// estado final (409), orden TERMINADA solo para administración (403) y, en ese caso, motivo obligatorio (400).
function assertCanModify(order, actor, reason) {
  if (actor.role === 'RECEPTIONIST') {
    throw AppError.forbidden('Recepción no puede modificar las refacciones de una orden.');
  }
  if (actor.role === 'MECHANIC' && order.mechanic_id !== actor.id) {
    throw AppError.forbidden('Solo el mecánico asignado puede modificar las refacciones de esta orden.');
  }
  if (order.status === 'ENTREGADO' || order.status === 'CANCELADA') {
    throw AppError.conflict(`La orden está en estado ${order.status} y ya no admite cambios en las refacciones.`);
  }
  if (order.status === 'TERMINADO') {
    if (actor.role !== 'ADMIN') {
      throw AppError.forbidden('Solo la administración puede modificar las refacciones de una orden terminada.');
    }
    if (!reason) {
      throw AppError.validation('Indica el motivo del cambio en una orden terminada.', [
        { field: 'reason', message: 'El motivo es obligatorio en una orden terminada.' }
      ]);
    }
  }
}

async function requireLockedOrder(orderId, conn) {
  const order = await orderModel.lockById(orderId, conn);
  if (!order) {
    throw AppError.notFound('La orden no existe.');
  }
  return order;
}

async function requireLine(orderId, lineId, conn) {
  const line = await orderPartModel.findLine(orderId, lineId, conn);
  if (!line) {
    throw AppError.notFound('La refacción no está en esta orden.');
  }
  return line;
}

async function requireLockedPart(partId, conn) {
  const [part] = await partModel.lockMany([partId], conn);
  if (!part) {
    throw AppError.notFound('La refacción no existe.');
  }
  return part;
}

// Aplica el movimiento al stock de la refacción ya bloqueada y lo registra ligado a la orden.
async function moveStock(part, delta, { order, actor, reason }, conn) {
  let stockAfter;
  try {
    stockAfter = applyDelta(part.stock, delta);
  } catch (error) {
    throw translateRuleError(error, part);
  }
  if (delta < 0) {
    // Defensa adicional contra carreras: la baja solo se aplica si todavía alcanza.
    if (!(await partModel.decrementIfEnough(part.id, -delta, conn))) {
      throw AppError.insufficientStock(part.name, part.stock);
    }
  } else {
    await partModel.applyStock(part.id, stockAfter, conn);
  }
  await inventoryMovementModel.insert(
    {
      partId: part.id,
      type: delta < 0 ? 'SALIDA' : 'ENTRADA',
      quantity: delta,
      stockAfter,
      reason,
      orderId: order.id,
      createdBy: actor.id
    },
    conn
  );
}

const detailOf = async (orderId, actor) => buildOrderDetail(await orderModel.findById(orderId), actor);

// Agrega una refacción a la orden: copia el precio de venta vigente, descuenta el stock y registra la salida.
export async function addPart(orderId, { partId, quantity, reason }, actor) {
  await withTransaction(async (conn) => {
    const order = await requireLockedOrder(orderId, conn);
    assertCanModify(order, actor, reason);
    const part = await requireLockedPart(partId, conn);
    if (!part.active) {
      throw AppError.partInactive();
    }
    if (await orderPartModel.findByOrderAndPart(orderId, partId, conn)) {
      throw AppError.partAlreadyInOrder();
    }
    await moveStock(part, -quantity, { order, actor, reason: withMotive(`Uso en la orden ${order.folio}`, reason) }, conn);
    await orderPartModel.insert({ orderId, partId, quantity, unitPrice: part.sale_price }, conn);
  });
  return detailOf(orderId, actor);
}

// Cambia la cantidad: registra solo la diferencia (salida si aumenta, devolución si disminuye).
export async function updatePartQuantity(orderId, lineId, { quantity, reason }, actor) {
  await withTransaction(async (conn) => {
    const order = await requireLockedOrder(orderId, conn);
    assertCanModify(order, actor, reason);
    const line = await requireLine(orderId, lineId, conn);
    const delta = quantity - line.quantity;
    if (delta === 0) {
      return;
    }
    const part = await requireLockedPart(line.part_id, conn);
    if (delta > 0 && !part.active) {
      throw AppError.partInactive();
    }
    const base =
      delta > 0
        ? `Más unidades en la orden ${order.folio}`
        : `Devolución parcial de la orden ${order.folio}`;
    await moveStock(part, -delta, { order, actor, reason: withMotive(base, reason) }, conn);
    await orderPartModel.updateQuantity(line.id, quantity, conn);
  });
  return detailOf(orderId, actor);
}

// Quita la línea y devuelve las unidades al inventario; el movimiento original se conserva.
export async function removePart(orderId, lineId, { reason }, actor) {
  await withTransaction(async (conn) => {
    const order = await requireLockedOrder(orderId, conn);
    assertCanModify(order, actor, reason);
    const line = await requireLine(orderId, lineId, conn);
    const part = await requireLockedPart(line.part_id, conn);
    await moveStock(
      part,
      line.quantity,
      { order, actor, reason: withMotive(`Devolución: refacción quitada de la orden ${order.folio}`, reason) },
      conn
    );
    await orderPartModel.remove(line.id, conn);
  });
  return detailOf(orderId, actor);
}

// Al cancelar la orden: cada refacción regresa al inventario. Las líneas se conservan como registro.
// Se llama dentro de la transacción de changeStatus, con la orden ya bloqueada, y solo una vez porque la
// transición a CANCELADA solo existe desde un estado abierto.
export async function returnAllParts(order, actor, conn) {
  const lines = await orderPartModel.listRawByOrderForUpdate(order.id, conn);
  if (lines.length === 0) {
    return;
  }
  const parts = await partModel.lockMany(
    lines.map((line) => line.part_id),
    conn
  );
  for (const part of parts) {
    const line = lines.find((item) => item.part_id === part.id);
    await moveStock(
      part,
      line.quantity,
      { order, actor, reason: clip(`Devolución por cancelación de la orden ${order.folio}`) },
      conn
    );
  }
}
