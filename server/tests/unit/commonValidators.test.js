import { FieldErrors, parseNonNegativeInt, parseQuantity, requiredReason } from '../../validators/common.js';

const conErrores = (accion) => {
  const errors = new FieldErrors();
  const valor = accion(errors);
  return { valor, errores: errors.items };
};

describe('parseQuantity', () => {
  test('acepta enteros de 1 a 99999', () => {
    expect(conErrores((e) => parseQuantity(e, 1, 'quantity', 'La cantidad')).valor).toBe(1);
    expect(conErrores((e) => parseQuantity(e, 99999, 'quantity', 'La cantidad')).valor).toBe(99999);
  });

  test('rechaza cero, negativos, decimales, texto y valores fuera de rango', () => {
    for (const valor of [0, -1, 1.5, '3', null, undefined, 100000, Number.NaN]) {
      const { valor: resultado, errores } = conErrores((e) => parseQuantity(e, valor, 'quantity', 'La cantidad'));
      expect(resultado).toBeUndefined();
      expect(errores).toHaveLength(1);
      expect(errores[0].field).toBe('quantity');
    }
  });
});

describe('parseNonNegativeInt', () => {
  test('acepta enteros de 0 al máximo indicado', () => {
    expect(conErrores((e) => parseNonNegativeInt(e, 0, 'minStock', 'El stock mínimo', 50)).valor).toBe(0);
    expect(conErrores((e) => parseNonNegativeInt(e, 50, 'minStock', 'El stock mínimo', 50)).valor).toBe(50);
  });

  test('rechaza negativos, decimales, texto, valores ausentes y mayores al máximo', () => {
    for (const valor of [-1, 0.5, '2', null, undefined, 51]) {
      const { valor: resultado, errores } = conErrores((e) => parseNonNegativeInt(e, valor, 'minStock', 'El stock mínimo', 50));
      expect(resultado).toBeUndefined();
      expect(errores).toHaveLength(1);
    }
  });
});

describe('requiredReason', () => {
  test('devuelve el motivo recortado', () => {
    expect(conErrores((e) => requiredReason(e, { reason: '  Conteo físico  ' })).valor).toBe('Conteo físico');
  });

  test('rechaza un motivo vacío, ausente o de más de 255 caracteres', () => {
    for (const body of [{ reason: '   ' }, {}, { reason: 'x'.repeat(256) }]) {
      const { errores } = conErrores((e) => requiredReason(e, body));
      expect(errores).toHaveLength(1);
      expect(errores[0].field).toBe('reason');
    }
  });

  test('permite indicar otro campo y otra etiqueta', () => {
    const { errores } = conErrores((e) => requiredReason(e, {}, 'cancelReason', 'El motivo de cancelación'));
    expect(errores[0]).toEqual({ field: 'cancelReason', message: 'El motivo de cancelación es obligatorio.' });
  });
});
