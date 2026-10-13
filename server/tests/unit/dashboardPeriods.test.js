import { resolvePeriod, upcomingRange, PERIOD_KEYS } from '../../services/dashboardPeriods.js';

// Fecha local fija para no depender del reloj de la máquina.
const ahora = new Date(2026, 9, 13, 15, 30, 45); // 13 de octubre de 2026, 15:30:45

const fecha = (d) => [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()];

describe('resolvePeriod', () => {
  test('expone las tres claves permitidas', () => {
    expect(PERIOD_KEYS).toEqual(['today', 'week', 'month']);
  });

  test('today va de las 00:00 al último instante de hoy', () => {
    const { key, from, to } = resolvePeriod('today', ahora);
    expect(key).toBe('today');
    expect(fecha(from)).toEqual([2026, 10, 13, 0, 0, 0, 0]);
    expect(fecha(to)).toEqual([2026, 10, 13, 23, 59, 59, 999]);
  });

  test('week cubre hoy y los seis días anteriores', () => {
    const { from, to } = resolvePeriod('week', ahora);
    expect(fecha(from)).toEqual([2026, 10, 7, 0, 0, 0, 0]);
    expect(fecha(to)).toEqual([2026, 10, 13, 23, 59, 59, 999]);
  });

  test('month va del día 1 del mes en curso al fin de hoy', () => {
    const { from, to } = resolvePeriod('month', ahora);
    expect(fecha(from)).toEqual([2026, 10, 1, 0, 0, 0, 0]);
    expect(fecha(to)).toEqual([2026, 10, 13, 23, 59, 59, 999]);
  });

  test('week cruza el cambio de mes y de año', () => {
    const { from } = resolvePeriod('week', new Date(2027, 0, 3, 10, 0, 0));
    expect(fecha(from)).toEqual([2026, 12, 28, 0, 0, 0, 0]);
  });

  test('month el día 1 incluye solo ese día', () => {
    const { from, to } = resolvePeriod('month', new Date(2026, 10, 1, 8, 0, 0));
    expect(fecha(from)).toEqual([2026, 11, 1, 0, 0, 0, 0]);
    expect(fecha(to)).toEqual([2026, 11, 1, 23, 59, 59, 999]);
  });

  test('rechaza una clave desconocida', () => {
    expect(() => resolvePeriod('year', ahora)).toThrow(/periodo/i);
    expect(() => resolvePeriod(undefined, ahora)).toThrow();
  });
});

describe('upcomingRange', () => {
  test('va de ahora al fin del séptimo día', () => {
    const { from, to } = upcomingRange(ahora);
    expect(from.getTime()).toBe(ahora.getTime());
    expect(fecha(to)).toEqual([2026, 10, 20, 23, 59, 59, 999]);
  });

  test('cruza el fin de mes', () => {
    const { to } = upcomingRange(new Date(2026, 9, 28, 9, 0, 0));
    expect(fecha(to)).toEqual([2026, 11, 4, 23, 59, 59, 999]);
  });
});
