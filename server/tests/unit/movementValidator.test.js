import { validateMovementCreate } from '../../validators/movementValidator.js';

const camposConError = (body) => {
  try {
    validateMovementCreate(body);
  } catch (error) {
    return (error.details ?? []).map((d) => d.field);
  }
  return [];
};

describe('validateMovementCreate', () => {
  test('acepta una ENTRADA con cantidad y motivo', () => {
    expect(validateMovementCreate({ type: 'ENTRADA', quantity: 10, reason: ' Compra al proveedor ' })).toEqual({
      type: 'ENTRADA',
      quantity: 10,
      reason: 'Compra al proveedor'
    });
  });

  test('acepta un AJUSTE con el stock contado, incluido cero', () => {
    expect(validateMovementCreate({ type: 'AJUSTE', countedStock: 0, reason: 'Conteo físico' })).toEqual({
      type: 'AJUSTE',
      countedStock: 0,
      reason: 'Conteo físico'
    });
  });

  test('la ENTRADA exige una cantidad de 1 a 99999', () => {
    for (const quantity of [0, -3, 2.5, 100000, undefined, '4']) {
      expect(camposConError({ type: 'ENTRADA', quantity, reason: 'x' })).toContain('quantity');
    }
  });

  test('el AJUSTE exige un stock contado entero de 0 a 99999999', () => {
    for (const countedStock of [-1, 1.2, 100000000, undefined, '3']) {
      expect(camposConError({ type: 'AJUSTE', countedStock, reason: 'x' })).toContain('countedStock');
    }
  });

  test('rechaza las SALIDAS manuales y cualquier otro tipo', () => {
    const salida = camposConError({ type: 'SALIDA', quantity: 1, reason: 'x' });
    expect(salida).toContain('type');
    expect(camposConError({ type: 'OTRO', quantity: 1, reason: 'x' })).toContain('type');
    expect(camposConError({ quantity: 1, reason: 'x' })).toContain('type');
  });

  test('el motivo es obligatorio y no supera 255 caracteres', () => {
    expect(camposConError({ type: 'ENTRADA', quantity: 1, reason: '  ' })).toContain('reason');
    expect(camposConError({ type: 'ENTRADA', quantity: 1 })).toContain('reason');
    expect(camposConError({ type: 'ENTRADA', quantity: 1, reason: 'x'.repeat(256) })).toContain('reason');
  });
});
