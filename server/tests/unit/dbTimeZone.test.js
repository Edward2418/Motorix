import { readTimeZone } from '../../config/dbTimeZone.js';

describe('zona horaria de la sesión con la base de datos', () => {
  test.each([undefined, '', '   '])('sin valor («%s») no se cambia la de la base', (valor) => {
    expect(readTimeZone(valor)).toBeUndefined();
  });

  test.each(['-06:00', '+00:00', ' -06:00 '])('acepta un desfase como «%s»', (valor) => {
    expect(readTimeZone(valor)).toBe(valor.trim());
  });

  test.each(['America/Mexico_City', '-6', "-06:00'; DROP TABLE users", '25:00'])('rechaza «%s» con un mensaje que nombra la variable', (valor) => {
    expect(() => readTimeZone(valor)).toThrow(/DB_TIME_ZONE/);
  });
});
