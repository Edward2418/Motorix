// Reglas puras del inventario. Módulo sin acceso a la base de datos: recibe números y decide.
// El servicio las usa dentro de la transacción; la base de datos las refuerza con un CHECK (stock >= 0).

export const MAX_QUANTITY = 99999;
export const MAX_STOCK = 99999999;

// Error de regla de inventario; `code` permite al servicio traducirlo a una respuesta HTTP.
export class StockRuleError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'StockRuleError';
    this.code = code;
    Object.assign(this, extra);
  }
}

function requireInteger(value, label) {
  if (!Number.isInteger(value)) {
    throw new StockRuleError('INVALID', `${label} debe ser un número entero.`);
  }
}

/**
 * Aplica un movimiento (positivo suma, negativo resta) y devuelve el stock resultante.
 * Lanza StockRuleError si el resultado sería negativo (NEGATIVE_STOCK) o superaría el máximo (MAX_STOCK).
 */
export function applyDelta(stock, delta) {
  requireInteger(stock, 'El stock actual');
  requireInteger(delta, 'La cantidad');
  const result = stock + delta;
  if (result < 0) {
    throw new StockRuleError('NEGATIVE_STOCK', 'El stock no puede quedar negativo.', { available: stock });
  }
  if (result > MAX_STOCK) {
    throw new StockRuleError('MAX_STOCK', `El stock no puede superar ${MAX_STOCK} unidades.`, { available: stock });
  }
  return result;
}

/** Diferencia con signo entre el stock registrado y el contado físicamente. Cero si coinciden. */
export function adjustmentDelta(current, counted) {
  requireInteger(current, 'El stock actual');
  requireInteger(counted, 'El stock contado');
  if (counted < 0 || counted > MAX_STOCK) {
    throw new StockRuleError('INVALID', `El stock contado debe estar entre 0 y ${MAX_STOCK}.`);
  }
  return counted - current;
}

/** Nivel de stock: AGOTADO en cero, BAJO si no supera el mínimo, NORMAL en otro caso. */
export function levelOf({ stock, minStock }) {
  if (stock === 0) {
    return 'AGOTADO';
  }
  return stock <= minStock ? 'BAJO' : 'NORMAL';
}
