import * as reportService from '../services/reportService.js';
import { validateReportQuery } from '../validators/reportValidator.js';
import { sendData } from '../utils/response.js';

export async function income(req, res) {
  const query = validateReportQuery(req.query);
  sendData(res, await reportService.income(query));
}
