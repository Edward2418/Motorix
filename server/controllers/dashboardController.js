import * as dashboardService from '../services/dashboardService.js';
import { validateDashboardQuery } from '../validators/dashboardValidator.js';
import { sendData } from '../utils/response.js';

export async function get(req, res) {
  const { period } = validateDashboardQuery(req.query);
  sendData(res, await dashboardService.getDashboard(period));
}
