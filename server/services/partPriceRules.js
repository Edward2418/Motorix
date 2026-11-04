import { AppError } from '../utils/AppError.js';
import { toCents } from '../utils/money.js';

// Regla pura de la confirmación del precio de venta menor al de compra (FR-003 y FR-004). Sin acceso a la base de datos.

const has = (changes, field) => Object.prototype.hasOwnProperty.call(changes, field) && changes[field] !== undefined;

// ¿Hace falta que la administración confirme de forma explícita?
// - `current`: precios vigentes de la refacción al editar (null al registrarla).
// - `changes`: campos que trae la petición. Solo se exige confirmar si la petición trae un precio y, con los precios
//   resultantes, la venta queda menor a la compra. Editar solo otros datos de una refacción que ya está en esa
//   situación no exige confirmar de nuevo. Un precio de venta cero con precio de compra mayor que cero también lo exige.
export function requiresBelowCostConfirmation({ current = null, changes }) {
  if (!has(changes, 'purchasePrice') && !has(changes, 'salePrice')) {
    return false;
  }
  const purchasePrice = has(changes, 'purchasePrice') ? changes.purchasePrice : current?.purchasePrice;
  const salePrice = has(changes, 'salePrice') ? changes.salePrice : current?.salePrice;
  return toCents(salePrice) < toCents(purchasePrice);
}

// Rechaza con 422 PRICE_BELOW_COST si hace falta confirmar y no se confirmó.
export function assertPriceConfirmed({ current = null, changes, confirmed = false }) {
  if (!confirmed && requiresBelowCostConfirmation({ current, changes })) {
    throw AppError.priceBelowCost();
  }
}
