import { validatePaymentCreate, validatePaymentCancel } from '../../validators/paymentValidator.js';

const camposInvalidos = (fn) => {
  try {
    fn();
  } catch (error) {
    return error.details?.map((d) => d.field) ?? [];
  }
  throw new Error('Se esperaba un error de validación y no se lanzó ninguno.');
};

describe('validatePaymentCreate', () => {
  test('acepta un pago válido y recorta la referencia', () => {
    expect(validatePaymentCreate({ amount: 250.5, method: 'EFECTIVO', reference: '  AUT-884213  ' })).toEqual({
      amount: 250.5,
      method: 'EFECTIVO',
      reference: 'AUT-884213'
    });
  });

  test('la referencia es opcional y vacía equivale a nulo', () => {
    expect(validatePaymentCreate({ amount: 10, method: 'TARJETA' }).reference).toBeNull();
    expect(validatePaymentCreate({ amount: 10, method: 'TARJETA', reference: '   ' }).reference).toBeNull();
  });

  test('acepta los cuatro métodos', () => {
    for (const method of ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'MERCADO_PAGO']) {
      expect(validatePaymentCreate({ amount: 1, method }).method).toBe(method);
    }
  });

  test('rechaza importes en cero, negativos, con tres decimales, texto o NaN', () => {
    for (const amount of [0, -5, 10.123, '100', NaN, null, undefined]) {
      expect({ amount, campos: camposInvalidos(() => validatePaymentCreate({ amount, method: 'EFECTIVO' })) }).toEqual({
        amount,
        campos: ['amount']
      });
    }
  });

  test('rechaza un importe mayor a 99,999,999.99', () => {
    expect(camposInvalidos(() => validatePaymentCreate({ amount: 100000000, method: 'EFECTIVO' }))).toEqual(['amount']);
    expect(validatePaymentCreate({ amount: 99999999.99, method: 'EFECTIVO' }).amount).toBe(99999999.99);
  });

  test('rechaza un método ausente o desconocido', () => {
    expect(camposInvalidos(() => validatePaymentCreate({ amount: 10 }))).toEqual(['method']);
    expect(camposInvalidos(() => validatePaymentCreate({ amount: 10, method: 'BITCOIN' }))).toEqual(['method']);
    expect(camposInvalidos(() => validatePaymentCreate({ amount: 10, method: 'efectivo' }))).toEqual(['method']);
  });

  test('rechaza una referencia de más de 100 caracteres', () => {
    expect(camposInvalidos(() => validatePaymentCreate({ amount: 10, method: 'EFECTIVO', reference: 'x'.repeat(101) }))).toEqual([
      'reference'
    ]);
  });

  test('rechaza un cuerpo que no es un objeto', () => {
    expect(() => validatePaymentCreate(null)).toThrow();
    expect(() => validatePaymentCreate([])).toThrow();
  });

  test('ignora los campos desconocidos, como los de tarjeta, y no los devuelve', () => {
    const resultado = validatePaymentCreate({ amount: 10, method: 'TARJETA', cardNumber: '4111111111111111', cvv: '123' });
    expect(Object.keys(resultado).sort()).toEqual(['amount', 'method', 'reference']);
  });
});

describe('validatePaymentCancel', () => {
  test('exige un motivo y lo recorta', () => {
    expect(validatePaymentCancel({ reason: '  Pago duplicado  ' })).toEqual({ reason: 'Pago duplicado' });
  });

  test('rechaza un motivo ausente, vacío o de más de 255 caracteres', () => {
    for (const reason of [undefined, '', '   ', 'x'.repeat(256)]) {
      expect({ reason, campos: camposInvalidos(() => validatePaymentCancel({ reason })) }).toEqual({ reason, campos: ['reason'] });
    }
  });
});
