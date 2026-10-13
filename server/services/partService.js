import { withTransaction } from '../config/db.js';
import * as inventoryMovementModel from '../models/inventoryMovementModel.js';
import * as partModel from '../models/partModel.js';
import { AppError } from '../utils/AppError.js';

// Catálogo de refacciones. El mecánico solo consulta refacciones activas y nunca recibe el precio de compra.

const isMechanic = (actor) => actor.role === 'MECHANIC';
const present = (row, actor) => partModel.toPart(row, { includePurchasePrice: !isMechanic(actor) });
const isDuplicateCode = (error) => error?.code === 'ER_DUP_ENTRY';

async function requirePart(id, actor) {
  const row = await partModel.findById(id);
  // Para el mecánico, una refacción desactivada es como si no existiera.
  if (!row || (isMechanic(actor) && !row.active)) {
    throw AppError.notFound('La refacción no existe.');
  }
  return row;
}

// Registra la refacción y, si trae stock inicial, su primer movimiento de ENTRADA, todo en una transacción.
export async function createPart(input, actor) {
  let id;
  try {
    id = await withTransaction(async (conn) => {
      const partId = await partModel.insert({ ...input, stock: input.initialStock }, conn);
      if (input.initialStock > 0) {
        await inventoryMovementModel.insert(
          {
            partId,
            type: 'ENTRADA',
            quantity: input.initialStock,
            stockAfter: input.initialStock,
            reason: 'Stock inicial',
            createdBy: actor.id
          },
          conn
        );
      }
      return partId;
    });
  } catch (error) {
    throw isDuplicateCode(error) ? AppError.duplicatePartCode() : error;
  }
  return present(await partModel.findById(id), actor);
}

export async function listParts(filters, actor) {
  // El mecánico solo ve refacciones activas: los filtros de estado y de stock bajo son de administración.
  const effective = isMechanic(actor) ? { ...filters, active: true, lowStock: false } : filters;
  const { page, pageSize } = filters;
  const { rows, total } = await partModel.list(effective, { page, pageSize });
  return { data: rows.map((row) => present(row, actor)), page, pageSize, total };
}

// Refacciones activas con stock igual o menor al mínimo (aviso de reabastecimiento, solo administración).
export async function listAlerts(actor) {
  return (await partModel.listAlerts()).map((row) => present(row, actor));
}

export async function getPart(id, actor) {
  return present(await requirePart(id, actor), actor);
}

export async function listCategories(actor) {
  return partModel.listCategories({ activeOnly: isMechanic(actor) });
}

// Edita datos descriptivos, precios y mínimo. El stock nunca se toca: solo cambia mediante movimientos.
export async function updatePart(id, fields, actor) {
  await requirePart(id, actor);
  try {
    await partModel.update(id, fields);
  } catch (error) {
    throw isDuplicateCode(error) ? AppError.duplicatePartCode() : error;
  }
  return present(await partModel.findById(id), actor);
}

// Desactiva o reactiva (nunca se elimina). Los movimientos y las líneas de órdenes se conservan.
export async function setPartActive(id, active, actor) {
  await requirePart(id, actor);
  await partModel.setActive(id, active);
  return present(await partModel.findById(id), actor);
}
