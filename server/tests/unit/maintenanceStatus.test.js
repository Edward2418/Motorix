import { classifyMaintenance, compareUrgency } from '../../services/maintenanceStatus.js';

const base = { today: '2026-10-13', soonDays: 30, soonKm: 1000, currentMileage: 50000 };
const clasificar = (extra) => classifyMaintenance({ dueDate: null, dueMileage: null, ...base, ...extra });

describe('classifyMaintenance por fecha', () => {
  test('una fecha pasada es VENCIDO', () => {
    const r = clasificar({ dueDate: '2026-10-12' });
    expect(r.visualStatus).toBe('VENCIDO');
    expect(r.remainingDays).toBe(-1);
  });

  test('la fecha de hoy es PROXIMO, no VENCIDO', () => {
    const r = clasificar({ dueDate: '2026-10-13' });
    expect(r.visualStatus).toBe('PROXIMO');
    expect(r.remainingDays).toBe(0);
  });

  test('a exactamente el umbral de días es PROXIMO', () => {
    expect(clasificar({ dueDate: '2026-11-12' }).visualStatus).toBe('PROXIMO');
  });

  test('un día después del umbral es NORMAL', () => {
    expect(clasificar({ dueDate: '2026-11-13' }).visualStatus).toBe('NORMAL');
  });

  test('cuenta bien los días al cruzar el cambio de mes y de año', () => {
    const r = classifyMaintenance({ ...base, today: '2026-12-20', dueDate: '2027-01-05', dueMileage: null });
    expect(r.remainingDays).toBe(16);
  });
});

describe('classifyMaintenance por kilometraje', () => {
  test('un kilometraje alcanzado es VENCIDO', () => {
    const r = clasificar({ dueMileage: 50000 });
    expect(r.visualStatus).toBe('VENCIDO');
    expect(r.remainingKm).toBe(0);
  });

  test('un kilometraje superado es VENCIDO con restante negativo', () => {
    const r = clasificar({ dueMileage: 49000 });
    expect(r.visualStatus).toBe('VENCIDO');
    expect(r.remainingKm).toBe(-1000);
  });

  test('a exactamente el umbral de kilómetros es PROXIMO', () => {
    expect(clasificar({ dueMileage: 51000 }).visualStatus).toBe('PROXIMO');
  });

  test('un kilómetro después del umbral es NORMAL', () => {
    expect(clasificar({ dueMileage: 51001 }).visualStatus).toBe('NORMAL');
  });
});

describe('classifyMaintenance con fecha y kilometraje', () => {
  test('manda el más grave: fecha lejana pero kilometraje alcanzado es VENCIDO', () => {
    expect(clasificar({ dueDate: '2027-06-01', dueMileage: 50000 }).visualStatus).toBe('VENCIDO');
  });

  test('manda el más grave: kilometraje lejano pero fecha próxima es PROXIMO', () => {
    expect(clasificar({ dueDate: '2026-10-20', dueMileage: 90000 }).visualStatus).toBe('PROXIMO');
  });

  test('ambos lejanos es NORMAL y devuelve los dos restantes', () => {
    const r = clasificar({ dueDate: '2027-03-01', dueMileage: 60000 });
    expect(r.visualStatus).toBe('NORMAL');
    expect(r.remainingDays).toBeGreaterThan(30);
    expect(r.remainingKm).toBe(10000);
  });

  test('sin fecha ni kilometraje devuelve restantes nulos', () => {
    const r = clasificar({});
    expect(r.remainingDays).toBeNull();
    expect(r.remainingKm).toBeNull();
  });

  test('respeta umbrales personalizados', () => {
    const r = classifyMaintenance({ ...base, dueDate: '2026-10-20', dueMileage: null, soonDays: 3 });
    expect(r.visualStatus).toBe('NORMAL');
  });
});

describe('compareUrgency', () => {
  const item = (id, visualStatus, remainingDays = null, remainingKm = null) => ({ id, visualStatus, remainingDays, remainingKm });

  test('ordena vencidos, luego próximos y luego normales', () => {
    const lista = [item(1, 'NORMAL', 90), item(2, 'VENCIDO', -3), item(3, 'PROXIMO', 5)];
    expect(lista.sort(compareUrgency).map((x) => x.id)).toEqual([2, 3, 1]);
  });

  test('dentro de un grupo, primero la fecha más cercana', () => {
    const lista = [item(1, 'VENCIDO', -1), item(2, 'VENCIDO', -10), item(3, 'VENCIDO', -4)];
    expect(lista.sort(compareUrgency).map((x) => x.id)).toEqual([2, 3, 1]);
  });

  test('los que solo tienen kilometraje van después de los que tienen fecha, por menor kilometraje restante', () => {
    const lista = [item(1, 'PROXIMO', null, 800), item(2, 'PROXIMO', 20), item(3, 'PROXIMO', null, 100)];
    expect(lista.sort(compareUrgency).map((x) => x.id)).toEqual([2, 3, 1]);
  });

  test('con empate total se ordena por identificador', () => {
    const lista = [item(9, 'NORMAL', 40), item(4, 'NORMAL', 40)];
    expect(lista.sort(compareUrgency).map((x) => x.id)).toEqual([4, 9]);
  });
});
