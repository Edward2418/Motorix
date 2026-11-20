import * as reportService from '../services/reportService.js';
import { validateReportQuery } from '../validators/reportValidator.js';
import { sendData } from '../utils/response.js';

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
    return sendCsv(res, reportService.incomeFileName(report), reportService.incomeToCsv(report));
  }
  return sendData(res, report);
}
