import { requiresBelowCostConfirmation, assertPriceConfirmed } from '../../services/partPriceRules.js';
import { AppError } from '../../utils/AppError.js';

describe('requiresBelowCostConfirmation (alta)', () => {
  test('exige confirmación si el precio de venta es menor al de compra', () => {
    expect(requiresBelowCostConfirmation({ changes: { purchasePrice: 100, salePrice: 80 } })).toBe(true);
  });

  test('no exige confirmación si la venta es igual o mayor que la compra', () => {
    expect(requiresBelowCostConfirmation({ changes: { purchasePrice: 100, salePrice: 100 } })).toBe(false);
    expect(requiresBelowCostConfirmation({ changes: { purchasePrice: 100, salePrice: 150 } })).toBe(false);
  });

  test('un precio de venta cero con precio de compra mayor que cero exige confirmación', () => {
    expect(requiresBelowCostConfirmation({ changes: { purchasePrice: 50, salePrice: 0 } })).toBe(true);
  });

  test('un precio de venta cero con precio de compra cero no exige confirmación', () => {
    expect(requiresBelowCostConfirmation({ changes: { purchasePrice: 0, salePrice: 0 } })).toBe(false);
  });

  test('compara en centavos: 0.1 + 0.2 y 0.3 son el mismo precio', () => {
    expect(requiresBelowCostConfirmation({ changes: { purchasePrice: 0.1 + 0.2, salePrice: 0.3 } })).toBe(false);
  });
});

describe('requiresBelowCostConfirmation (edición)', () => {
  const yaBajoElCosto = { purchasePrice: 100, salePrice: 80 };

  test('editar solo otros datos de una refacción que ya está bajo el costo no exige confirmar de nuevo', () => {
    expect(requiresBelowCostConfirmation({ current: yaBajoElCosto, changes: { name: 'Otro nombre' } })).toBe(false);
    expect(requiresBelowCostConfirmation({ current: yaBajoElCosto, changes: { minStock: 3 } })).toBe(false);
  });

  test('cambiar un precio y que la venta siga siendo menor a la compra exige confirmación', () => {
    expect(requiresBelowCostConfirmation({ current: yaBajoElCosto, changes: { salePrice: 90 } })).toBe(true);
  });

  test('cambiar un precio y que la venta deje de ser menor a la compra no exige confirmación', () => {
    expect(requiresBelowCostConfirmation({ current: yaBajoElCosto, changes: { salePrice: 120 } })).toBe(false);
  });

  test('subir el precio de compra por encima de la venta exige confirmación', () => {
    expect(requiresBelowCostConfirmation({ current: { purchasePrice: 50, salePrice: 60 }, changes: { purchasePrice: 70 } })).toBe(true);
  });
});

describe('assertPriceConfirmed', () => {
  const bajoElCosto = { changes: { purchasePrice: 100, salePrice: 80 } };

  test('rechaza con 422 PRICE_BELOW_COST si hace falta confirmar y no se confirmó', () => {
    expect(() => assertPriceConfirmed({ ...bajoElCosto, confirmed: false })).toThrow(AppError);
    try {
      assertPriceConfirmed({ ...bajoElCosto, confirmed: false });
    } catch (error) {
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('PRICE_BELOW_COST');
    }
  });

  test('no rechaza si se confirmó o si no hacía falta', () => {
    expect(() => assertPriceConfirmed({ ...bajoElCosto, confirmed: true })).not.toThrow();
    expect(() => assertPriceConfirmed({ changes: { purchasePrice: 50, salePrice: 80 }, confirmed: false })).not.toThrow();
  });
});
