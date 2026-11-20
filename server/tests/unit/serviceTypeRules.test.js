import { computeSuggestions, validateServiceTypeInput } from '../../services/serviceTypeRules.js';

const campos = (resultado) => resultado.errors.map((e) => e.field).sort();

describe('validación de un tipo de servicio', () => {
  test('un tipo con nombre y los dos intervalos es válido y se normaliza', () => {
    const r = validateServiceTypeInput({ name: '  Cambio de aceite  ', intervalDays: 180, intervalKm: 5000 });
    expect(r.errors).toEqual([]);
    expect(r.value).toEqual({ name: 'Cambio de aceite', intervalDays: 180, intervalKm: 5000 });
  });

  test('basta con un intervalo: el otro queda nulo', () => {
    expect(validateServiceTypeInput({ name: 'Alineación', intervalDays: 365 }).value).toEqual({
      name: 'Alineación',
      intervalDays: 365,
      intervalKm: null
    });
    expect(validateServiceTypeInput({ name: 'Balanceo', intervalKm: 10000, intervalDays: null }).value).toEqual({
      name: 'Balanceo',
      intervalDays: null,
      intervalKm: 10000
    });
  });

  test.each([[''], ['   '], [undefined], [123], ['x'.repeat(81)]])('rechaza un nombre inválido (%p)', (name) => {
    expect(campos(validateServiceTypeInput({ name, intervalDays: 30 }))).toContain('name');
  });

  test('acepta nombres de 1 y de 80 caracteres', () => {
    expect(validateServiceTypeInput({ name: 'A', intervalDays: 30 }).errors).toEqual([]);
    expect(validateServiceTypeInput({ name: 'x'.repeat(80), intervalDays: 30 }).errors).toEqual([]);
  });

  test.each([[0], [3651], [-5], [1.5], ['30'], [NaN]])('rechaza unos días de intervalo inválidos (%p)', (intervalDays) => {
    expect(campos(validateServiceTypeInput({ name: 'X', intervalDays, intervalKm: 5000 }))).toContain('intervalDays');
  });

  test('acepta 1 y 3650 días', () => {
    expect(validateServiceTypeInput({ name: 'X', intervalDays: 1 }).errors).toEqual([]);
    expect(validateServiceTypeInput({ name: 'X', intervalDays: 3650 }).errors).toEqual([]);
  });

  test.each([[0], [500001], [-1], [2.5], ['5000']])('rechaza unos kilómetros de intervalo inválidos (%p)', (intervalKm) => {
    expect(campos(validateServiceTypeInput({ name: 'X', intervalDays: 30, intervalKm }))).toContain('intervalKm');
  });

  test('acepta 1 y 500,000 kilómetros', () => {
    expect(validateServiceTypeInput({ name: 'X', intervalKm: 1 }).errors).toEqual([]);
    expect(validateServiceTypeInput({ name: 'X', intervalKm: 500000 }).errors).toEqual([]);
  });

  test('exige al menos uno de los dos intervalos', () => {
    const r = validateServiceTypeInput({ name: 'X' });
    expect(r.errors).toEqual([{ field: 'intervalDays', message: 'Indica al menos un intervalo: en días, en kilómetros o en ambos.' }]);
    expect(validateServiceTypeInput({ name: 'X', intervalDays: null, intervalKm: null }).errors).toHaveLength(1);
  });

  test('acumula varios errores a la vez', () => {
    expect(campos(validateServiceTypeInput({ name: '', intervalDays: 0, intervalKm: 0 }))).toEqual(['intervalDays', 'intervalKm', 'name']);
  });
});

describe('propuesta del próximo mantenimiento', () => {
  const aceite = { id: 1, name: 'Cambio de aceite', intervalDays: 180, intervalKm: 5000 };
  const base = { today: '2026-11-20', serviceMileage: 42000, currentMileage: 42000 };

  test('suma el intervalo en días a hoy y el intervalo en kilómetros al kilometraje del servicio', () => {
    expect(computeSuggestions({ ...base, types: [aceite] })).toEqual([
      { serviceTypeId: 1, serviceTypeName: 'Cambio de aceite', description: 'Cambio de aceite', dueDate: '2027-05-19', dueMileage: 47000 }
    ]);
  });

  test('cruza el fin de año y respeta los años bisiestos', () => {
    const [a] = computeSuggestions({ ...base, today: '2027-12-30', types: [{ ...aceite, intervalDays: 3 }] });
    expect(a.dueDate).toBe('2028-01-02');
    const [b] = computeSuggestions({ ...base, today: '2028-02-28', types: [{ ...aceite, intervalDays: 2 }] });
    expect(b.dueDate).toBe('2028-03-01');
  });

  test('un tipo sin intervalo en días deja la fecha nula, y sin intervalo en km deja el kilometraje nulo', () => {
    const [soloKm] = computeSuggestions({ ...base, types: [{ ...aceite, intervalDays: null }] });
    expect(soloKm).toMatchObject({ dueDate: null, dueMileage: 47000 });
    const [soloDias] = computeSuggestions({ ...base, types: [{ ...aceite, intervalKm: null }] });
    expect(soloDias).toMatchObject({ dueDate: '2027-05-19', dueMileage: null });
  });

  test('sin tipos, o sin tipos con intervalo, la lista es vacía', () => {
    expect(computeSuggestions({ ...base, types: [] })).toEqual([]);
    expect(computeSuggestions({ ...base, types: [{ id: 2, name: 'Sin datos', intervalDays: null, intervalKm: null }] })).toEqual([]);
  });

  test('si el servicio no tiene kilometraje usa el actual del vehículo', () => {
    const [a] = computeSuggestions({ ...base, serviceMileage: null, currentMileage: 43000, types: [aceite] });
    expect(a.dueMileage).toBe(48000);
  });

  test('el kilometraje propuesto siempre es mayor al actual del vehículo aunque el del servicio sea menor', () => {
    const [a] = computeSuggestions({ ...base, serviceMileage: 40000, currentMileage: 45000, types: [aceite] });
    expect(a.dueMileage).toBe(50000);
    expect(a.dueMileage).toBeGreaterThan(45000);
  });

  test('un tipo repetido en varias líneas produce una sola propuesta, en el orden recibido', () => {
    const otro = { id: 2, name: 'Alineación', intervalDays: 365, intervalKm: null };
    const resultado = computeSuggestions({ ...base, types: [aceite, otro, aceite] });
    expect(resultado.map((s) => s.serviceTypeId)).toEqual([1, 2]);
  });
});
