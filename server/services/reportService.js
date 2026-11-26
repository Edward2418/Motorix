import * as reportModel from '../models/reportModel.js';
import { toCsv } from './csvExport.js';
import { centsToPesos, marginTotals, partMargins, turnoverRow } from './reportRules.js';

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
export const reportFileName = (report, { from, to }) => `${report}-${from}-a-${to}.csv`;

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

const SERVICE_COLUMNS = Object.freeze([
  { label: 'Servicio', type: 'text' },
  { label: 'Cantidad', type: 'int' },
  { label: 'Importe', type: 'money' }
]);

const PRODUCTIVITY_COLUMNS = Object.freeze([
  { label: 'Mecánico', type: 'text' },
  { label: 'Órdenes terminadas', type: 'int' },
  { label: 'Mano de obra', type: 'money' }
]);

const MARGIN_COLUMNS = Object.freeze([
  { label: 'Código', type: 'text' },
  { label: 'Refacción', type: 'text' },
  { label: 'Piezas', type: 'int' },
  { label: 'Precio de venta', type: 'money' },
  { label: 'Precio de compra', type: 'money' },
  { label: 'Margen por pieza', type: 'money' },
  { label: 'Venta total', type: 'money' },
  { label: 'Costo total', type: 'money' },
  { label: 'Margen total', type: 'money' },
  { label: 'Observación', type: 'text' }
]);

// La existencia promedio y la rotación llevan dos decimales, igual que un importe.
const TURNOVER_COLUMNS = Object.freeze([
  { label: 'Código', type: 'text' },
  { label: 'Refacción', type: 'text' },
  { label: 'Unidades que salieron', type: 'int' },
  { label: 'Existencia promedio', type: 'money' },
  { label: 'Rotación', type: 'text' }
]);

const optionalPesos = (cents) => (cents === null ? null : centsToPesos(cents));

/** Servicios de las órdenes terminadas en el rango, del más al menos frecuente. Devuelve todas las filas. */
export async function services({ start, end }) {
  const rows = await reportModel.serviceFrequency({ start, end });
  return rows.map(({ cents, ...row }) => ({ ...row, total: centsToPesos(cents) }));
}

export const servicesToCsv = (rows) =>
  toCsv({ columns: SERVICE_COLUMNS, rows: rows.map((row) => [row.name, row.count, row.total]) });

/** Órdenes terminadas y mano de obra del rango por mecánico. */
export async function productivity({ start, end }) {
  const rows = await reportModel.mechanicProductivity({ start, end });
  return rows.map(({ laborCents, ...row }) => ({ ...row, laborTotal: centsToPesos(laborCents) }));
}

export const productivityToCsv = (rows) =>
  toCsv({ columns: PRODUCTIVITY_COLUMNS, rows: rows.map((row) => [row.mechanicName, row.finishedOrders, row.laborTotal]) });

/** Margen de las refacciones usadas en el rango y sus totales (calculados sobre todas las filas, en centavos). */
export async function partsMargin({ start, end }) {
  const rows = (await reportModel.partsSold({ start, end })).map(partMargins);
  const totals = marginTotals(rows);
  return {
    items: rows.map((row) => ({
      partId: row.partId,
      code: row.code,
      name: row.name,
      quantity: row.quantity,
      salePrice: centsToPesos(row.saleCents),
      purchasePrice: optionalPesos(row.purchaseCents),
      marginPerUnit: optionalPesos(row.marginPerUnitCents),
      salesTotal: centsToPesos(row.salesCents),
      costTotal: optionalPesos(row.costCents),
      marginTotal: optionalPesos(row.marginCents),
      withoutCost: row.withoutCost
    })),
    totals: {
      salesTotal: centsToPesos(totals.salesCents),
      costTotal: centsToPesos(totals.costCents),
      marginTotal: centsToPesos(totals.marginCents),
      withoutCostCount: totals.withoutCostCount
    }
  };
}

export const partsMarginToCsv = ({ items, totals }) =>
  toCsv({
    columns: MARGIN_COLUMNS,
    rows: items.map((row) => [
      row.code,
      row.name,
      row.quantity,
      row.salePrice,
      row.purchasePrice,
      row.marginPerUnit,
      row.salesTotal,
      row.costTotal,
      row.marginTotal,
      row.withoutCost ? 'Sin costo' : ''
    ]),
    totals: [
      'Total',
      '',
      items.reduce((sum, row) => sum + row.quantity, 0),
      null,
      null,
      null,
      totals.salesTotal,
      totals.costTotal,
      totals.marginTotal,
      totals.withoutCostCount > 0 ? `Sin costo: ${totals.withoutCostCount}` : ''
    ]
  });

/** Rotación por refacción en el rango, de la que más salió a la que menos. */
export async function inventoryTurnover({ start, end }) {
  const rows = await reportModel.inventoryFlow({ start, end });
  return rows.map(({ initialStock, finalStock, ...row }) => ({ ...row, ...turnoverRow({ unitsOut: row.unitsOut, initialStock, finalStock }) }));
}

export const inventoryTurnoverToCsv = (rows) =>
  toCsv({
    columns: TURNOVER_COLUMNS,
    rows: rows.map((row) => [row.code, row.name, row.unitsOut, row.averageStock, row.turnover === null ? 'Sin existencia' : row.turnover.toFixed(2)])
  });
