import { FieldErrors, parseNonNegativeInt, parseQuantity, requiredReason, requireBody } from './common.js';
import { MAX_STOCK } from '../services/stockRules.js';

// Movimiento manual de inventario: ENTRADA (cantidad a sumar) o AJUSTE (stock contado). Las SALIDAS solo las
// genera el uso de refacciones en las órdenes.
export function validateMovementCreate(body) {
  const data = requireBody(body);
  const errors = new FieldErrors();

  if (data.type === 'SALIDA') {
    errors.add('type', 'Las salidas solo las genera el uso de refacciones en las órdenes.');
  } else if (data.type !== 'ENTRADA' && data.type !== 'AJUSTE') {
    errors.add('type', 'El tipo debe ser ENTRADA o AJUSTE.');
  }

  const reason = requiredReason(errors, data);
  let result;
  if (data.type === 'ENTRADA') {
    const quantity = parseQuantity(errors, data.quantity, 'quantity', 'La cantidad');
    result = { type: 'ENTRADA', quantity, reason };
  } else if (data.type === 'AJUSTE') {
    const countedStock = parseNonNegativeInt(errors, data.countedStock, 'countedStock', 'El stock contado', MAX_STOCK);
    result = { type: 'AJUSTE', countedStock, reason };
  }

  errors.throwIfAny();
  return result;
}
