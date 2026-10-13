import * as vehicleService from '../services/vehicleService.js';
import { validateVehicleInput, validateVehicleListQuery } from '../validators/vehicleValidator.js';
import { parseId, validateStatusBody } from '../validators/common.js';
import { sendData, sendPage } from '../utils/response.js';

const vehicleId = (req) => parseId(req.params.id, 'El identificador del vehículo');

export async function list(req, res) {
  sendPage(res, await vehicleService.listVehicles(validateVehicleListQuery(req.query)));
}

export async function get(req, res) {
  sendData(res, await vehicleService.getVehicle(vehicleId(req)));
}

export async function create(req, res) {
  sendData(res, await vehicleService.createVehicle(validateVehicleInput(req.body)), 201);
}

export async function setStatus(req, res) {
  const id = vehicleId(req);
  const active = validateStatusBody(req.body);
  sendData(res, await vehicleService.setVehicleStatus(id, active));
}
