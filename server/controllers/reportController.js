import * as reportService from '../services/reportService.js';
import { validateReportPage, validateReportQuery } from '../validators/reportValidator.js';
import { sendData, sendPage } from '../utils/response.js';

// Responde el archivo CSV como descarga. Nunca se cachea: los reportes cambian con cada pago.
function sendCsv(res, fileName, csv) {
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'Cache-Control': 'no-store'
  });
  return res.status(200).send(csv);
}

export async function income(req, res) {
  const query = validateReportQuery(req.query);
  const report = await reportService.income(query);
  if (query.format === 'csv') {
    return sendCsv(res, reportService.reportFileName('ingresos', report), reportService.incomeToCsv(report));
  }
  return sendData(res, report);
}

const slice = (rows, { page, pageSize }) => rows.slice((page - 1) * pageSize, page * pageSize);

// El CSV siempre lleva todas las filas del rango; la paginación solo aplica a la respuesta JSON.
export async function services(req, res) {
  const query = validateReportQuery(req.query);
  const paging = validateReportPage(req.query);
  const rows = await reportService.services(query);
  if (query.format === 'csv') {
    return sendCsv(res, reportService.reportFileName('servicios', query), reportService.servicesToCsv(rows));
  }
  return sendPage(res, { data: slice(rows, paging), ...paging, total: rows.length });
}

export async function productivity(req, res) {
  const query = validateReportQuery(req.query);
  const rows = await reportService.productivity(query);
  if (query.format === 'csv') {
    return sendCsv(res, reportService.reportFileName('productividad', query), reportService.productivityToCsv(rows));
  }
  return sendData(res, rows);
}

// Los totales del margen cubren todo el rango; la página solo recorta las filas.
export async function partsMargin(req, res) {
  const query = validateReportQuery(req.query);
  const paging = validateReportPage(req.query);
  const report = await reportService.partsMargin(query);
  if (query.format === 'csv') {
    return sendCsv(res, reportService.reportFileName('margen-refacciones', query), reportService.partsMarginToCsv(report));
  }
  return res.status(200).json({
    data: { items: slice(report.items, paging), totals: report.totals },
    meta: { ...paging, total: report.items.length }
  });
}

export async function inventoryTurnover(req, res) {
  const query = validateReportQuery(req.query);
  const paging = validateReportPage(req.query);
  const rows = await reportService.inventoryTurnover(query);
  if (query.format === 'csv') {
    return sendCsv(res, reportService.reportFileName('rotacion', query), reportService.inventoryTurnoverToCsv(rows));
  }
  return sendPage(res, { data: slice(rows, paging), ...paging, total: rows.length });
}
