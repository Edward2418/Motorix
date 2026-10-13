import * as maintenanceService from '../services/maintenanceService.js';
import {
  validateCancel,
  validateFulfill,
  validateMaintenanceCreate,
  validateMaintenanceListQuery
} from '../validators/maintenanceValidator.js';
import { parseId } from '../validators/common.js';
import { sendData, sendPage } from '../utils/response.js';

const maintenanceId = (req) => parseId(req.params.id, 'El identificador del mantenimiento');

export async function list(req, res) {
  sendPage(res, await maintenanceService.listMaintenance(validateMaintenanceListQuery(req.query)));
}

// POST /orders/:id/maintenance: programa el próximo mantenimiento desde una orden.
export async function createFromOrder(req, res) {
  const orderId = parseId(req.params.id, 'El identificador de la orden');
  sendData(res, await maintenanceService.createMaintenance(orderId, validateMaintenanceCreate(req.body), req.user), 201);
}

export async function fulfill(req, res) {
  const id = maintenanceId(req);
  sendData(res, await maintenanceService.fulfillMaintenance(id, validateFulfill(req.body), req.user));
}

export async function cancel(req, res) {
  const id = maintenanceId(req);
  sendData(res, await maintenanceService.cancelMaintenance(id, validateCancel(req.body), req.user));
}
