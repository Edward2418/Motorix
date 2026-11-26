import { partMargins, marginTotals, turnoverRow } from '../../services/reportRules.js';

const linea = (datos) => ({ partId: 1, code: 'REF-1', name: 'Bujía', quantity: 1, saleCents: 15000, purchaseCents: 10000, ...datos });

describe('margen de refacciones', () => {
  test('el margen por pieza es la venta menos la compra', () => {
    expect(partMargins(linea({ quantity: 3 }))).toMatchObject({
      marginPerUnitCents: 5000,
      salesCents: 45000,
      costCents: 30000,
      marginCents: 15000,
      withoutCost: false
    });
  });

  test.each([0, null])('con precio de compra %s se marca sin costo y no calcula margen', (purchaseCents) => {
    expect(partMargins(linea({ purchaseCents, quantity: 2 }))).toMatchObject({
      purchaseCents: null,
      marginPerUnitCents: null,
      marginCents: null,
      costCents: null,
      salesCents: 30000,
      withoutCost: true
    });
  });

  test('vender por debajo del costo da un margen negativo', () => {
    expect(partMargins(linea({ saleCents: 8000 })).marginCents).toBe(-2000);
  });

  test('los totales excluyen del costo y del margen lo que no tiene costo, y cuentan esas refacciones una vez', () => {
    const filas = [
      partMargins(linea({ quantity: 2 })),
      partMargins(linea({ partId: 2, purchaseCents: 0, saleCents: 700 })),
      partMargins(linea({ partId: 2, purchaseCents: 0, saleCents: 900 }))
    ];

    expect(marginTotals(filas)).toEqual({ salesCents: 31600, costCents: 20000, marginCents: 10000, withoutCostCount: 1 });
  });

  test('en centavos no hay errores de redondeo', () => {
    const fila = partMargins(linea({ saleCents: 30, purchaseCents: 10, quantity: 3 }));
    expect(fila.marginCents).toBe(60);
  });

  test('sin filas, todos los totales son cero', () => {
    expect(marginTotals([])).toEqual({ salesCents: 0, costCents: 0, marginCents: 0, withoutCostCount: 0 });
  });
});

describe('rotación de inventario', () => {
  test('es las salidas entre la existencia promedio, con dos decimales', () => {
    expect(turnoverRow({ unitsOut: 2, initialStock: 10, finalStock: 8 })).toEqual({ averageStock: 9, turnover: 0.22 });
  });

  test('el promedio puede tener medias piezas', () => {
    expect(turnoverRow({ unitsOut: 5, initialStock: 0, finalStock: 5 })).toEqual({ averageStock: 2.5, turnover: 2 });
  });

  test('con existencia promedio 0 la rotación es nula y no infinita', () => {
    expect(turnoverRow({ unitsOut: 4, initialStock: 0, finalStock: 0 })).toEqual({ averageStock: 0, turnover: null });
  });
});
