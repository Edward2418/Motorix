import { toCsv } from '../../services/csvExport.js';

const BOM = '﻿';
const columnas = [
  { label: 'Concepto', type: 'text' },
  { label: 'Pagos', type: 'int' },
  { label: 'Total', type: 'money' }
];

// Separa un CSV en líneas sin la marca BOM (el formato de línea es CRLF).
const lineas = (csv) => csv.replace(BOM, '').split('\r\n');

describe('formato general', () => {
  test('empieza con la marca BOM UTF-8 para que Excel muestre bien los acentos', () => {
    const csv = toCsv({ columns: columnas, rows: [], totals: ['Total', 0, 0] });
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv.indexOf(BOM, 1)).toBe(-1);
  });

  test('separa con comas, termina cada fila con CRLF y empieza con la fila de encabezados', () => {
    const csv = toCsv({ columns: columnas, rows: [['Efectivo', 2, 750]], totals: ['Total', 2, 750] });
    expect(csv).toBe(`${BOM}Concepto,Pagos,Total\r\nEfectivo,2,750.00\r\nTotal,2,750.00\r\n`);
  });

  test('la última fila es la de totales', () => {
    const l = lineas(toCsv({ columns: columnas, rows: [['A', 1, 10], ['B', 2, 20]], totals: ['Total', 3, 30] }));
    expect(l).toEqual(['Concepto,Pagos,Total', 'A,1,10.00', 'B,2,20.00', 'Total,3,30.00', '']);
  });

  test('un reporte sin filas produce los encabezados y el total en cero', () => {
    const l = lineas(toCsv({ columns: columnas, rows: [], totals: ['Total', 0, 0] }));
    expect(l).toEqual(['Concepto,Pagos,Total', 'Total,0,0.00', '']);
  });

  test('sin fila de totales solo salen encabezados y filas', () => {
    expect(lineas(toCsv({ columns: columnas, rows: [['A', 1, 1]] }))).toEqual(['Concepto,Pagos,Total', 'A,1,1.00', '']);
  });
});

describe('importes', () => {
  test('se escriben con punto y exactamente dos decimales', () => {
    const l = lineas(toCsv({ columns: columnas, rows: [['A', 1, 1234.5], ['B', 1, 0.1], ['C', 1, 0], ['D', 1, 99999999.99]], totals: null }));
    expect(l.slice(1, 5)).toEqual(['A,1,1234.50', 'B,1,0.10', 'C,1,0.00', 'D,1,99999999.99']);
  });

  test('no usa separador de miles ni símbolo de moneda', () => {
    const csv = toCsv({ columns: columnas, rows: [['A', 1, 1234567.89]], totals: null });
    expect(csv).toContain('1234567.89');
    expect(csv).not.toMatch(/[$]|1,234/);
  });

  test('un importe nulo o vacío queda como celda vacía, no como cero inventado', () => {
    const l = lineas(toCsv({ columns: columnas, rows: [['Día', null, 5]], totals: null }));
    expect(l[1]).toBe('Día,,5.00');
  });

  test('los enteros se escriben sin decimales', () => {
    expect(lineas(toCsv({ columns: columnas, rows: [['A', 1500, 1]], totals: null }))[1]).toBe('A,1500,1.00');
  });
});

describe('escape de texto', () => {
  const una = (valor) => lineas(toCsv({ columns: [{ label: 'Texto', type: 'text' }], rows: [[valor]], totals: null })).slice(1, -1).join('\r\n');

  test('un campo con coma va entre comillas', () => {
    expect(una('Cambio de aceite, filtro')).toBe('"Cambio de aceite, filtro"');
  });

  test('las comillas dobles se escapan duplicándolas', () => {
    expect(una('Llanta de 17" nueva')).toBe('"Llanta de 17"" nueva"');
  });

  test('un campo con salto de línea va entre comillas y conserva el salto', () => {
    expect(una('línea 1\nlínea 2')).toBe('"línea 1\nlínea 2"');
  });

  test('un texto simple no lleva comillas y conserva acentos y eñes', () => {
    expect(una('Afinación niño')).toBe('Afinación niño');
  });

  test('los espacios al inicio o al final se conservan entre comillas', () => {
    expect(una(' con espacios ')).toBe('" con espacios "');
  });

  test('un texto vacío o nulo queda como celda vacía', () => {
    expect(una('')).toBe('');
    expect(una(null)).toBe('');
    expect(una(undefined)).toBe('');
  });

  test('los encabezados también se escapan', () => {
    const csv = toCsv({ columns: [{ label: 'Total, en pesos', type: 'money' }], rows: [], totals: null });
    expect(lineas(csv)[0]).toBe('"Total, en pesos"');
  });

  test('un texto que empieza como fórmula (=, +, -, @) se neutraliza para que la hoja de cálculo no lo ejecute', () => {
    expect(una('=SUMA(A1:A9)')).toBe("'=SUMA(A1:A9)");
    expect(una('+52 55 1234')).toBe("'+52 55 1234");
    expect(una('@usuario')).toBe("'@usuario");
    expect(una('-cmd')).toBe("'-cmd");
  });

  test('los importes negativos no se tratan como fórmula', () => {
    const l = lineas(toCsv({ columns: columnas, rows: [['Ajuste', 1, -50]], totals: null }));
    expect(l[1]).toBe('Ajuste,1,-50.00');
  });
});

describe('validaciones', () => {
  test('una fila con distinto número de celdas que las columnas es un error de programación', () => {
    expect(() => toCsv({ columns: columnas, rows: [['solo una']], totals: null })).toThrow(/celdas/);
  });

  test('una fila de totales con distinto número de celdas también', () => {
    expect(() => toCsv({ columns: columnas, rows: [], totals: ['Total'] })).toThrow(/celdas/);
  });
});
