import { toCents, fromCents, sumCents } from '../../utils/money.js';

describe('toCents', () => {
  test('convierte importes con dos decimales a centavos enteros sin errores de coma flotante', () => {
    expect(toCents(33.33)).toBe(3333);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(1234.56)).toBe(123456);
    expect(toCents('99.99')).toBe(9999);
  });

  test('convierte el máximo de un importe a centavos exactos', () => {
    expect(toCents('99999999.99')).toBe(9999999999);
    expect(toCents(99999999.99)).toBe(9999999999);
  });
});

describe('fromCents', () => {
  test('convierte centavos enteros a importe con dos decimales', () => {
    expect(fromCents(9999)).toBe(99.99);
    expect(fromCents(0)).toBe(0);
    expect(fromCents(9999999999)).toBe(99999999.99);
  });

  test('el viaje de ida y vuelta conserva el importe', () => {
    for (const valor of [0.01, 0.07, 19.99, 1000.1, 4770, 12345678.9]) {
      expect(fromCents(toCents(valor))).toBe(valor);
    }
  });
});

describe('sumCents', () => {
  test('suma centavos enteros', () => {
    expect(sumCents([3333, 3333, 3333])).toBe(9999);
    expect(sumCents([])).toBe(0);
  });

  test('3 × 33.33 es exactamente 99.99 (sin errores de coma flotante)', () => {
    const importeLinea = 3 * toCents(33.33);
    expect(importeLinea).toBe(9999);
    expect(fromCents(importeLinea)).toBe(99.99);
  });

  test('la suma de líneas con centavos coincide con el total en centavos', () => {
    const lineas = [toCents(850), toCents(450), 3 * toCents(33.33), toCents(1660.01)];
    expect(sumCents(lineas)).toBe(306000);
    expect(fromCents(sumCents(lineas))).toBe(3060);
  });
});
