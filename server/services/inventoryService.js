import { withTransaction } from '../config/db.js';
import * as inventoryMovementModel from '../models/inventoryMovementModel.js';
import * as partModel from '../models/partModel.js';
import { AppError } from '../utils/AppError.js';
import { adjustmentDelta, applyDelta, StockRuleError } from './stockRules.js';

// Movimientos manuales de inventario (solo administración): entradas y ajustes por conteo físico.
// Las salidas las genera únicamente el uso de refacciones en las órdenes (orderPartService).

// Traduce un error de las reglas puras a la respuesta HTTP correspondiente.
export function translateRuleError(error, part, field = 'quantity') {
  if (!(error instanceof StockRuleError)) {
    return error;
  }
  if (error.code === 'NEGATIVE_STOCK') {
    return AppError.insufficientStock(part.name, part.stock);
  }
  return AppError.validation(error.message, [{ field, message: error.message }]);
}

async function requireLockedPart(partId, conn) {
  const part = await partModel.lockById(partId, conn);
  if (!part) {
    throw AppError.notFound('La refacción no existe.');
  }
  return part;
}

// Aplica el movimiento al stock bloqueado y lo registra, en la transacción indicada.
async function applyMovement(part, { type, quantity, reason }, actor, conn, field) {
  let stockAfter;
  try {
    stockAfter = applyDelta(part.stock, quantity);
  } catch (error) {
    throw translateRuleError(error, part, field);
  }
  await partModel.applyStock(part.id, stockAfter, conn);
  const id = await inventoryMovementModel.insert(
    { partId: part.id, type, quantity, stockAfter, reason, createdBy: actor.id },
    conn
  );
  return inventoryMovementModel.findById(id, conn);
}

// Reabastecimiento: suma `quantity` al stock.
export async function registerEntry(partId, { quantity, reason }, actor) {
  return withTransaction(async (conn) => {
    const part = await requireLockedPart(partId, conn);
    return applyMovement(part, { type: 'ENTRADA', quantity, reason }, actor, conn, 'quantity');
  });
}

// Conteo físico: fija el stock en `countedStock`. La diferencia se calcula bajo bloqueo para que dos ajustes
// simultáneos no se pisen. Un ajuste sin diferencia se rechaza.
export async function registerAdjustment(partId, { countedStock, reason }, actor) {
  return withTransaction(async (conn) => {
    const part = await requireLockedPart(partId, conn);
    let delta;
    try {
      delta = adjustmentDelta(part.stock, countedStock);
    } catch (error) {
      throw translateRuleError(error, part, 'countedStock');
    }
    if (delta === 0) {
      throw AppError.noAdjustmentNeeded();
    }
    return applyMovement(part, { type: 'AJUSTE', quantity: delta, reason }, actor, conn, 'countedStock');
  });
}

export async function createMovement(partId, input, actor) {
  return input.type === 'ENTRADA' ? registerEntry(partId, input, actor) : registerAdjustment(partId, input, actor);
}

// Historial de movimientos de una refacción, del más reciente al más antiguo.
export async function listMovements(partId, { page, pageSize }) {
  if (!(await partModel.findById(partId))) {
    throw AppError.notFound('La refacción no existe.');
  }
  const { items, total } = await inventoryMovementModel.listByPart(partId, { page, pageSize });
  return { data: items, page, pageSize, total };
}
