import { applyDelta, adjustmentDelta, levelOf, MAX_STOCK, MAX_QUANTITY, StockRuleError } from '../../services/stockRules.js';

describe('applyDelta', () => {
  test('suma una entrada al stock', () => {
    expect(applyDelta(10, 5)).toBe(15);
  });

  test('resta una salida al stock', () => {
    expect(applyDelta(10, -4)).toBe(6);
  });

  test('permite dejar el stock exactamente en cero', () => {
    expect(applyDelta(3, -3)).toBe(0);
  });

  test('rechaza una salida que dejaría el stock negativo', () => {
    expect(() => applyDelta(3, -4)).toThrow(StockRuleError);
    try {
      applyDelta(3, -4);
    } catch (error) {
      expect(error.code).toBe('NEGATIVE_STOCK');
      expect(error.available).toBe(3);
    }
  });

  test('rechaza un resultado que supera el stock máximo', () => {
    expect(applyDelta(MAX_STOCK - 1, 1)).toBe(MAX_STOCK);
    expect(() => applyDelta(MAX_STOCK, 1)).toThrow(StockRuleError);
  });

  test('rechaza valores que no son enteros', () => {
    expect(() => applyDelta(1.5, 1)).toThrow(StockRuleError);
    expect(() => applyDelta(1, 0.5)).toThrow(StockRuleError);
    expect(() => applyDelta('1', 1)).toThrow(StockRuleError);
    expect(() => applyDelta(1, Number.NaN)).toThrow(StockRuleError);
  });

  test('expone los límites de cantidad y de stock', () => {
    expect(MAX_QUANTITY).toBe(99999);
    expect(MAX_STOCK).toBe(99999999);
  });
});

describe('adjustmentDelta', () => {
  test('devuelve la diferencia positiva cuando el conteo es mayor', () => {
    expect(adjustmentDelta(10, 14)).toBe(4);
  });

  test('devuelve la diferencia negativa cuando el conteo es menor', () => {
    expect(adjustmentDelta(10, 6)).toBe(-4);
  });

  test('devuelve cero cuando no hay diferencia', () => {
    expect(adjustmentDelta(7, 7)).toBe(0);
  });

  test('permite contar cero unidades', () => {
    expect(adjustmentDelta(7, 0)).toBe(-7);
  });

  test('rechaza un conteo negativo, no entero o superior al máximo', () => {
    expect(() => adjustmentDelta(7, -1)).toThrow(StockRuleError);
    expect(() => adjustmentDelta(7, 2.5)).toThrow(StockRuleError);
    expect(() => adjustmentDelta(7, MAX_STOCK + 1)).toThrow(StockRuleError);
  });
});

describe('levelOf', () => {
  test('es AGOTADO cuando el stock es cero', () => {
    expect(levelOf({ stock: 0, minStock: 5 })).toBe('AGOTADO');
    expect(levelOf({ stock: 0, minStock: 0 })).toBe('AGOTADO');
  });

  test('es BAJO cuando el stock es mayor que cero y no supera el mínimo', () => {
    expect(levelOf({ stock: 1, minStock: 5 })).toBe('BAJO');
    expect(levelOf({ stock: 5, minStock: 5 })).toBe('BAJO');
  });

  test('es NORMAL cuando el stock supera el mínimo', () => {
    expect(levelOf({ stock: 6, minStock: 5 })).toBe('NORMAL');
  });

  test('con mínimo cero solo alerta al llegar a cero', () => {
    expect(levelOf({ stock: 1, minStock: 0 })).toBe('NORMAL');
  });
});
