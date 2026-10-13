import {
  validateCancel,
  validateFulfill,
  validateMaintenanceCreate,
  validateMaintenanceListQuery
} from '../../validators/maintenanceValidator.js';

const camposConError = (fn, body) => {
  try {
    fn(body);
  } catch (error) {
    return (error.details ?? []).map((d) => d.field);
  }
  return [];
};

describe('validateMaintenanceCreate', () => {
  test('acepta descripción con solo fecha', () => {
    expect(validateMaintenanceCreate({ description: ' Cambio de aceite ', dueDate: '2027-01-15' })).toEqual({
      description: 'Cambio de aceite',
      dueDate: '2027-01-15',
      dueMileage: null,
      notes: null
    });
  });

  test('acepta solo kilometraje, o fecha y kilometraje juntos, con notas', () => {
    expect(validateMaintenanceCreate({ description: 'Frenos', dueMileage: 60000 }).dueMileage).toBe(60000);
    const ambos = validateMaintenanceCreate({ description: 'Frenos', dueDate: '2027-02-01', dueMileage: 60000, notes: ' Revisar discos ' });
    expect(ambos).toMatchObject({ dueDate: '2027-02-01', dueMileage: 60000, notes: 'Revisar discos' });
  });

  test('exige la descripción con un máximo de 255 caracteres', () => {
    expect(camposConError(validateMaintenanceCreate, { dueDate: '2027-01-15' })).toContain('description');
    expect(camposConError(validateMaintenanceCreate, { description: 'x'.repeat(256), dueDate: '2027-01-15' })).toContain('description');
  });

  test('exige al menos una fecha o un kilometraje', () => {
    expect(camposConError(validateMaintenanceCreate, { description: 'Frenos' }).length).toBeGreaterThan(0);
    expect(camposConError(validateMaintenanceCreate, { description: 'Frenos', dueDate: null, dueMileage: null }).length).toBeGreaterThan(0);
  });

  test('rechaza fechas con formato inválido o inexistentes en el calendario', () => {
    for (const dueDate of ['15/01/2027', '2027-13-01', '2027-02-30', 'mañana', 20270115]) {
      expect(camposConError(validateMaintenanceCreate, { description: 'Frenos', dueDate })).toContain('dueDate');
    }
  });

  test('rechaza kilometrajes en cero, negativos, decimales o texto', () => {
    for (const dueMileage of [0, -10, 1.5, '50000']) {
      expect(camposConError(validateMaintenanceCreate, { description: 'Frenos', dueMileage })).toContain('dueMileage');
    }
  });

  test('rechaza notas de más de 1000 caracteres', () => {
    expect(camposConError(validateMaintenanceCreate, { description: 'Frenos', dueMileage: 5, notes: 'x'.repeat(1001) })).toContain('notes');
  });
});

describe('validateFulfill', () => {
  test('el cuerpo es opcional', () => {
    expect(validateFulfill(undefined)).toEqual({ orderId: null });
    expect(validateFulfill({})).toEqual({ orderId: null });
    expect(validateFulfill({ orderId: 8 })).toEqual({ orderId: 8 });
  });

  test('rechaza una orden inválida', () => {
    for (const orderId of [0, -2, 1.5, '3']) {
      expect(camposConError(validateFulfill, { orderId })).toContain('orderId');
    }
  });
});

describe('validateCancel', () => {
  test('exige el motivo', () => {
    expect(validateCancel({ reason: ' El cliente lo pospuso ' })).toEqual({ reason: 'El cliente lo pospuso' });
    expect(camposConError(validateCancel, {})).toContain('reason');
    expect(camposConError(validateCancel, { reason: '  ' })).toContain('reason');
    expect(camposConError(validateCancel, { reason: 'x'.repeat(256) })).toContain('reason');
  });
});

describe('validateMaintenanceListQuery', () => {
  test('usa PROGRAMADO y la primera página por defecto', () => {
    expect(validateMaintenanceListQuery({})).toEqual({
      visualStatus: undefined,
      status: 'PROGRAMADO',
      clientId: undefined,
      vehicleId: undefined,
      q: '',
      page: 1,
      pageSize: 20
    });
  });

  test('interpreta los filtros', () => {
    const resultado = validateMaintenanceListQuery({ visualStatus: 'VENCIDO', status: 'ATENDIDO', clientId: '4', vehicleId: '9', q: ' ABC ', page: '2' });
    expect(resultado).toMatchObject({ visualStatus: 'VENCIDO', status: 'ATENDIDO', clientId: 4, vehicleId: 9, q: 'ABC', page: 2 });
  });

  test('rechaza valores inválidos', () => {
    expect(() => validateMaintenanceListQuery({ visualStatus: 'LEJANO' })).toThrow();
    expect(() => validateMaintenanceListQuery({ status: 'ABIERTO' })).toThrow();
    expect(() => validateMaintenanceListQuery({ clientId: '0' })).toThrow();
    expect(() => validateMaintenanceListQuery({ q: 'x'.repeat(101) })).toThrow();
  });
});
