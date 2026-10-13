import { readPositiveInt } from '../../utils/envNumbers.js';

describe('readPositiveInt', () => {
  test('devuelve el valor numérico cuando es un entero positivo', () => {
    expect(readPositiveInt('45', 30, 'MAINTENANCE_SOON_DAYS')).toBe(45);
    expect(readPositiveInt(' 7 ', 30, 'MAINTENANCE_SOON_DAYS')).toBe(7);
  });

  test('devuelve el valor por defecto cuando no hay valor', () => {
    expect(readPositiveInt(undefined, 30, 'MAINTENANCE_SOON_DAYS')).toBe(30);
    expect(readPositiveInt('', 1000, 'MAINTENANCE_SOON_KM')).toBe(1000);
    expect(readPositiveInt('   ', 1000, 'MAINTENANCE_SOON_KM')).toBe(1000);
  });

  test('rechaza cero, negativos, decimales y texto nombrando la variable', () => {
    for (const valor of ['0', '-5', '2.5', 'abc', '10km']) {
      expect(() => readPositiveInt(valor, 30, 'MAINTENANCE_SOON_DAYS')).toThrow(/MAINTENANCE_SOON_DAYS/);
    }
  });
});
