import * as reportModel from '../models/reportModel.js';
import { toCsv } from './csvExport.js';
import { centsToPesos } from './reportRules.js';

const METHOD_LABELS = Object.freeze({
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
  MERCADO_PAGO: 'Mercado Pago'
});

const INCOME_COLUMNS = Object.freeze([
  { label: 'Sección', type: 'text' },
  { label: 'Concepto', type: 'text' },
  { label: 'Pagos', type: 'int' },
  { label: 'Total', type: 'money' }
]);

/** Nombre del archivo de un reporte exportado, con su rango: `ingresos-2026-10-01-a-2026-10-31.csv`. */
export const incomeFileName = ({ from, to }) => `ingresos-${from}-a-${to}.csv`;

/**
 * CSV del reporte de ingresos, armado desde el MISMO resultado que la respuesta JSON (no hay otra consulta): una fila por
 * método de pago, una por día y la de totales al final.
 */
export function incomeToCsv(report) {
  return toCsv({
    columns: INCOME_COLUMNS,
    rows: [
      ...report.byMethod.map((row) => ['Por método de pago', METHOD_LABELS[row.method] ?? row.method, row.count, row.total]),
      ...report.byDay.map((row) => ['Por día', row.date, null, row.total])
    ],
    totals: ['Total', '', report.paymentsCount, report.total]
  });
}

// Reportes de solo lectura para administración (Sprint 7). Cada reporte calcula en centavos y devuelve pesos.

/**
 * Ingresos del rango: total, cantidad de pagos, desglose por método de pago y por día. Los totales son suma de los
 * desgloses, así que coinciden entre sí y con los pagos que los originan.
 */
export async function income({ from, to, start, end }) {
  const [byMethod, byDay] = await Promise.all([reportModel.incomeByMethod({ start, end }), reportModel.incomeByDay({ start, end })]);
  const totalCents = byMethod.reduce((sum, row) => sum + row.cents, 0);
  return {
    from,
    to,
    total: centsToPesos(totalCents),
    paymentsCount: byMethod.reduce((sum, row) => sum + row.count, 0),
    byMethod: byMethod.map((row) => ({ method: row.method, total: centsToPesos(row.cents), count: row.count })),
    byDay: byDay.map((row) => ({ date: row.date, total: centsToPesos(row.cents) }))
  };
}
