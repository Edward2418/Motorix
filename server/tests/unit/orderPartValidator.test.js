import {
  validateOrderPartAdd,
  validateOrderPartQuantity,
  validateOrderPartRemove
} from '../../validators/orderPartValidator.js';

const camposConError = (fn, body) => {
  try {
    fn(body);
  } catch (error) {
    return (error.details ?? []).map((d) => d.field);
  }
  return [];
};

describe('validateOrderPartAdd', () => {
  test('acepta refacción y cantidad, con motivo opcional', () => {
    expect(validateOrderPartAdd({ partId: 3, quantity: 2 })).toEqual({ partId: 3, quantity: 2, reason: null });
    expect(validateOrderPartAdd({ partId: 3, quantity: 2, reason: ' Faltó registrarla ' })).toEqual({
      partId: 3,
      quantity: 2,
      reason: 'Faltó registrarla'
    });
  });

  test('rechaza refacciones inválidas', () => {
    for (const partId of [0, -1, 1.5, '3', undefined]) {
      expect(camposConError(validateOrderPartAdd, { partId, quantity: 1 })).toContain('partId');
    }
  });

  test('rechaza cantidades en cero, negativas, decimales, texto o mayores a 99999', () => {
    for (const quantity of [0, -1, 1.5, '2', undefined, 100000]) {
      expect(camposConError(validateOrderPartAdd, { partId: 1, quantity })).toContain('quantity');
    }
  });

  test('rechaza un motivo de más de 255 caracteres', () => {
    expect(camposConError(validateOrderPartAdd, { partId: 1, quantity: 1, reason: 'x'.repeat(256) })).toContain('reason');
  });
});

describe('validateOrderPartQuantity', () => {
  test('acepta la nueva cantidad con motivo opcional', () => {
    expect(validateOrderPartQuantity({ quantity: 5 })).toEqual({ quantity: 5, reason: null });
  });

  test('rechaza cantidades inválidas', () => {
    for (const quantity of [0, -4, 0.5, 'tres', undefined]) {
      expect(camposConError(validateOrderPartQuantity, { quantity })).toContain('quantity');
    }
  });
});

describe('validateOrderPartRemove', () => {
  test('acepta que no haya cuerpo', () => {
    expect(validateOrderPartRemove(undefined)).toEqual({ reason: null });
    expect(validateOrderPartRemove({})).toEqual({ reason: null });
  });

  test('devuelve el motivo recortado cuando viene', () => {
    expect(validateOrderPartRemove({ reason: ' Error de captura ' })).toEqual({ reason: 'Error de captura' });
  });

  test('rechaza un motivo demasiado largo', () => {
    expect(camposConError(validateOrderPartRemove, { reason: 'x'.repeat(256) })).toContain('reason');
  });
});
