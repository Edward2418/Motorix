// Exportación a CSV de los reportes (Sprint 7). Función pura y sin dependencias: recibe las columnas, las filas y la fila
// de totales del MISMO resultado que la respuesta JSON, así el archivo y la pantalla no pueden diferir.
//
// Formato: marca BOM UTF-8 (para que Excel muestre bien los acentos), separador coma, filas terminadas en CRLF, comillas
// dobles escapadas por duplicación, una fila de encabezados y, al final, la de totales. Los importes llevan punto y
// exactamente dos decimales, sin separador de miles ni símbolo de moneda.

const BOM = '﻿';
const EOL = '\r\n';

// Un texto que empieza con = + - @ lo ejecutaría una hoja de cálculo como fórmula (inyección de fórmulas): se antepone
// un apóstrofo para que se muestre como texto.
const FORMULA_START = /^[=+\-@]/;

function escapeText(value) {
  if (value === null || value === undefined) {
    return '';
  }
  let text = String(value);
  if (FORMULA_START.test(text)) {
    text = `'${text}`;
  }
  const needsQuotes = /[",\r\n]/.test(text) || text !== text.trim();
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatCell(value, type) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  if (type === 'money') {
    return Number(value).toFixed(2);
  }
  if (type === 'int') {
    return String(Math.trunc(Number(value)));
  }
  return escapeText(value);
}

function formatRow(cells, columns, what) {
  if (cells.length !== columns.length) {
    throw new Error(`${what} tiene ${cells.length} celdas y el reporte tiene ${columns.length} columnas.`);
  }
  return cells.map((cell, index) => formatCell(cell, columns[index].type)).join(',');
}

/**
 * Arma el CSV. `columns`: `[{ label, type: 'text' | 'int' | 'money' }]`; `rows`: filas con una celda por columna;
 * `totals`: la fila final con el mismo número de celdas (o `null` si el reporte no tiene totales).
 */
export function toCsv({ columns, rows, totals = null }) {
  const lines = [columns.map((column) => escapeText(column.label)).join(',')];
  for (const row of rows) {
    lines.push(formatRow(row, columns, 'Una fila'));
  }
  if (totals) {
    lines.push(formatRow(totals, columns, 'La fila de totales'));
  }
  return `${BOM}${lines.join(EOL)}${EOL}`;
}
