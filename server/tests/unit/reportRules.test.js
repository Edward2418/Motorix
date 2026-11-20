import { centsToPesos, dayEnd, dayStart, sumCents, validateRange } from '../../services/reportRules.js';

describe('validación del rango de un reporte', () => {
  test('un rango válido devuelve el inicio del primer día, el fin del último y los días que abarca', () => {
    const r = validateRange('2026-10-01', '2026-10-31');
    expect(r.ok).toBe(true);
    expect(r.days).toBe(31);
    expect(r.start).toEqual(new Date(2026, 9, 1, 0, 0, 0, 0));
    expect(r.end).toEqual(new Date(2026, 9, 31, 23, 59, 59, 999));
  });

  test('un solo día es un rango válido de 1 día', () => {
    const r = validateRange('2026-10-05', '2026-10-05');
    expect(r.ok).toBe(true);
    expect(r.days).toBe(1);
  });

  test('acepta exactamente 366 días y rechaza 367', () => {
    expect(validateRange('2026-01-01', '2027-01-01')).toMatchObject({ ok: true, days: 366 });
    expect(validateRange('2026-01-01', '2027-01-02')).toMatchObject({ ok: false, code: 'REPORT_RANGE_INVALID' });
  });

  test('un año bisiesto completo cabe (366 días)', () => {
    expect(validateRange('2028-01-01', '2028-12-31')).toMatchObject({ ok: true, days: 366 });
  });

  test('from posterior a to es REPORT_RANGE_INVALID', () => {
    const r = validateRange('2026-10-10', '2026-10-01');
    expect(r).toMatchObject({ ok: false, code: 'REPORT_RANGE_INVALID' });
    expect(r.message).toMatch(/posterior/);
  });

  test.each([
    ['01/10/2026', '2026-10-31', 'from'],
    ['2026-10-01', '31-10-2026', 'to'],
    ['2026-02-30', '2026-03-01', 'from'],
    ['2026-10-01', '2026-13-01', 'to'],
    ['', '2026-10-31', 'from'],
    [undefined, '2026-10-31', 'from'],
    ['2026-10-01', null, 'to'],
    ['2026-10-1', '2026-10-31', 'from']
  ])('una fecha mal escrita o inexistente (%p, %p) es VALIDATION_ERROR en el campo %s', (from, to, campo) => {
    expect(validateRange(from, to)).toMatchObject({ ok: false, code: 'VALIDATION_ERROR', field: campo });
  });

  test('un cambio de horario no altera los días contados', () => {
    // Un rango que cruza el cambio de horario de verano sigue contando días naturales.
    expect(validateRange('2026-03-01', '2026-04-30')).toMatchObject({ ok: true, days: 61 });
    expect(validateRange('2026-10-01', '2026-11-30')).toMatchObject({ ok: true, days: 61 });
  });
});

describe('límites del día local', () => {
  test('el día empieza a las 00:00:00.000 y termina a las 23:59:59.999 en hora local', () => {
    expect(dayStart('2026-10-05')).toEqual(new Date(2026, 9, 5, 0, 0, 0, 0));
    expect(dayEnd('2026-10-05')).toEqual(new Date(2026, 9, 5, 23, 59, 59, 999));
  });

  test('un pago de las 23:59 cae dentro del día y uno de las 00:00 del siguiente, fuera', () => {
    const fin = dayEnd('2026-10-05').getTime();
    expect(new Date(2026, 9, 5, 23, 59, 0).getTime()).toBeLessThanOrEqual(fin);
    expect(new Date(2026, 9, 6, 0, 0, 0).getTime()).toBeGreaterThan(fin);
  });
});

describe('importes en centavos', () => {
  test('convierte centavos a pesos con dos decimales', () => {
    expect(centsToPesos(123456)).toBe(1234.56);
    expect(centsToPesos(1)).toBe(0.01);
    expect(centsToPesos(0)).toBe(0);
    expect(centsToPesos(10)).toBe(0.1);
  });

  test('suma sin los errores de redondeo de los decimales binarios', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(centsToPesos(sumCents(['0.10', '0.20']))).toBe(0.3);
    expect(sumCents([100.1, 200.2, 0.3])).toBe(30060);
  });

  test('sumar muchos importes pequeños es exacto', () => {
    const importes = Array.from({ length: 1000 }, () => '0.07');
    expect(sumCents(importes)).toBe(7000);
    expect(centsToPesos(sumCents(importes))).toBe(70);
  });

  test('una lista vacía suma cero', () => {
    expect(sumCents([])).toBe(0);
  });

  test('acepta importes como texto (así los devuelve DECIMAL) y como número', () => {
    expect(sumCents(['1234.56', 0.44])).toBe(123500);
  });
});
