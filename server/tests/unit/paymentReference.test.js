import { validateReference, validatePaymentCreate } from '../../validators/paymentValidator.js';

const MENSAJE = 'No escribas números de tarjeta: usa solo un número de autorización o de rastreo';

describe('validateReference', () => {
  test('acepta números de autorización o de rastreo normales', () => {
    for (const texto of ['AUT-884213', 'SPEI-20261013-0042', 'Folio 123', 'CLABE 0123', '1234567']) {
      expect({ texto, ...validateReference(texto) }).toEqual({ texto, value: texto, error: null });
    }
  });

  test('rechaza texto que parece un número de tarjeta, con o sin espacios o guiones', () => {
    for (const texto of ['4111111111111111', '4111 1111 1111 1111', '4111-1111-1111-1111', '5500 0000 0000 0004', '378282246310005']) {
      const resultado = validateReference(texto);
      expect({ texto, error: resultado.error }).toEqual({ texto, error: expect.stringContaining(MENSAJE) });
    }
  });

  test('no rechaza números largos que no pasan la validación de Luhn ni los demasiado cortos o largos', () => {
    for (const texto of ['4111111111111112', '123456789012', '12345678901234567890']) {
      expect({ texto, ...validateReference(texto) }).toEqual({ texto, value: texto, error: null });
    }
  });

  test('recorta espacios y trata vacío o ausente como nulo', () => {
    expect(validateReference('  AUT-1  ')).toEqual({ value: 'AUT-1', error: null });
    expect(validateReference('   ')).toEqual({ value: null, error: null });
    expect(validateReference(undefined)).toEqual({ value: null, error: null });
    expect(validateReference(null)).toEqual({ value: null, error: null });
  });
});

describe('validatePaymentCreate con referencia', () => {
  test('responde 400 en el campo reference si parece un número de tarjeta', () => {
    expect.assertions(2);
    try {
      validatePaymentCreate({ amount: 10, method: 'TARJETA', reference: '4111 1111 1111 1111' });
    } catch (error) {
      expect(error.details.map((d) => d.field)).toEqual(['reference']);
      expect(error.details[0].message).toContain(MENSAJE);
    }
  });
});
