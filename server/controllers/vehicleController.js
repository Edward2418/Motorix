import * as vehicleService from '../services/vehicleService.js';
import * as vehicleHistoryService from '../services/vehicleHistoryService.js';
import { validateVehicleInput, validateVehicleListQuery } from '../validators/vehicleValidator.js';
import { parseId, parsePagination, validateStatusBody } from '../validators/common.js';
import { sendData, sendPage } from '../utils/response.js';

const vehicleId = (req) => parseId(req.params.id, 'El identificador del vehículo');

export async function list(req, res) {
  sendPage(res, await vehicleService.listVehicles(validateVehicleListQuery(req.query)));
}

export async function get(req, res) {
  sendData(res, await vehicleService.getVehicle(vehicleId(req)));
}

// Historial de servicios del vehículo (solo lectura, derivado de las órdenes finalizadas).
export async function history(req, res) {
  const id = vehicleId(req);
  sendPage(res, await vehicleHistoryService.getHistory(id, parsePagination(req.query)));
}

export async function create(req, res) {
  sendData(res, await vehicleService.createVehicle(validateVehicleInput(req.body)), 201);
}

export async function setStatus(req, res) {
  const id = vehicleId(req);
  const active = validateStatusBody(req.body);
  sendData(res, await vehicleService.setVehicleStatus(id, active));
}
