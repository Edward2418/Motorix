import { validatePartCreate, validatePartListQuery, validatePartUpdate } from '../../validators/partValidator.js';

const valida = () => ({
  code: ' BUJ-001 ',
  name: ' Bujía de iridio ',
  category: 'Motor',
  brand: 'NGK',
  initialStock: 12,
  minStock: 4,
  purchasePrice: 85.5,
  salePrice: 129.9
});

const camposConError = (fn, body) => {
  try {
    fn(body);
  } catch (error) {
    return (error.details ?? []).map((d) => d.field);
  }
  return [];
};

describe('validatePartCreate', () => {
  test('recorta los textos y devuelve los datos válidos', () => {
    expect(validatePartCreate(valida())).toEqual({
      code: 'BUJ-001',
      name: 'Bujía de iridio',
      category: 'Motor',
      brand: 'NGK',
      initialStock: 12,
      minStock: 4,
      purchasePrice: 85.5,
      salePrice: 129.9
    });
  });

  test('el stock inicial es opcional y vale cero por defecto', () => {
    const { initialStock, ...sinStock } = valida();
    expect(initialStock).toBe(12);
    expect(validatePartCreate(sinStock).initialStock).toBe(0);
  });

  test('exige código, nombre, categoría y marca con sus longitudes máximas', () => {
    for (const [campo, largo] of [['code', 41], ['name', 121], ['category', 61], ['brand', 61]]) {
      expect(camposConError(validatePartCreate, { ...valida(), [campo]: '' })).toContain(campo);
      expect(camposConError(validatePartCreate, { ...valida(), [campo]: 'x'.repeat(largo) })).toContain(campo);
    }
  });

  test('rechaza cantidades negativas, decimales o mayores al máximo', () => {
    expect(camposConError(validatePartCreate, { ...valida(), initialStock: -1 })).toContain('initialStock');
    expect(camposConError(validatePartCreate, { ...valida(), initialStock: 1.5 })).toContain('initialStock');
    expect(camposConError(validatePartCreate, { ...valida(), minStock: 100000000 })).toContain('minStock');
    expect(camposConError(validatePartCreate, { ...valida(), minStock: undefined })).toContain('minStock');
  });

  test('rechaza precios negativos, con más de dos decimales o mayores a 99,999,999.99', () => {
    expect(camposConError(validatePartCreate, { ...valida(), purchasePrice: -1 })).toContain('purchasePrice');
    expect(camposConError(validatePartCreate, { ...valida(), salePrice: 10.123 })).toContain('salePrice');
    expect(camposConError(validatePartCreate, { ...valida(), salePrice: 100000000 })).toContain('salePrice');
    expect(camposConError(validatePartCreate, { ...valida(), salePrice: '10' })).toContain('salePrice');
  });

  test('rechaza un cuerpo que no es un objeto', () => {
    expect(() => validatePartCreate(null)).toThrow();
    expect(() => validatePartCreate([])).toThrow();
  });
});

describe('validatePartUpdate', () => {
  test('devuelve solo los campos enviados', () => {
    expect(validatePartUpdate({ salePrice: 150, name: ' Nuevo nombre ' })).toEqual({ salePrice: 150, name: 'Nuevo nombre' });
  });

  test('no acepta modificar el stock directamente', () => {
    expect(camposConError(validatePartUpdate, { stock: 50 })).toContain('stock');
    expect(camposConError(validatePartUpdate, { name: 'X', initialStock: 5 })).toContain('stock');
  });

  test('exige al menos un campo', () => {
    expect(camposConError(validatePartUpdate, {})).toContain('body');
  });

  test('valida cada campo enviado', () => {
    expect(camposConError(validatePartUpdate, { code: '' })).toContain('code');
    expect(camposConError(validatePartUpdate, { minStock: -2 })).toContain('minStock');
    expect(camposConError(validatePartUpdate, { purchasePrice: -2 })).toContain('purchasePrice');
  });
});

describe('validatePartListQuery', () => {
  test('usa valores por defecto', () => {
    expect(validatePartListQuery({})).toEqual({
      q: '',
      category: '',
      active: undefined,
      stockLevel: undefined,
      lowStock: false,
      page: 1,
      pageSize: 20
    });
  });

  test('interpreta los filtros enviados', () => {
    const query = { q: ' bujía ', category: 'Motor', active: 'false', stockLevel: 'BAJO', lowStock: 'true', page: '2', pageSize: '10' };
    expect(validatePartListQuery(query)).toEqual({
      q: 'bujía',
      category: 'Motor',
      active: false,
      stockLevel: 'BAJO',
      lowStock: true,
      page: 2,
      pageSize: 10
    });
  });

  test('rechaza valores inválidos', () => {
    expect(() => validatePartListQuery({ stockLevel: 'POCO' })).toThrow();
    expect(() => validatePartListQuery({ active: 'quizá' })).toThrow();
    expect(() => validatePartListQuery({ lowStock: '1' })).toThrow();
    expect(() => validatePartListQuery({ q: 'x'.repeat(101) })).toThrow();
    expect(() => validatePartListQuery({ page: '0' })).toThrow();
  });
});
