import * as serviceTypeService from '../services/serviceTypeService.js';
import { validateServiceTypeBody, validateServiceTypeListQuery, validateStatusBody } from '../validators/serviceTypeValidator.js';
import { parseId } from '../validators/common.js';
import { sendData } from '../utils/response.js';

const typeId = (req) => parseId(req.params.id, 'El identificador del tipo de servicio');

export async function list(req, res) {
  sendData(res, await serviceTypeService.listServiceTypes(validateServiceTypeListQuery(req.query)));
}

export async function create(req, res) {
  sendData(res, await serviceTypeService.createServiceType(validateServiceTypeBody(req.body)), 201);
}

export async function update(req, res) {
  const id = typeId(req);
  sendData(res, await serviceTypeService.updateServiceType(id, validateServiceTypeBody(req.body)));
}

export async function setStatus(req, res) {
  const id = typeId(req);
  sendData(res, await serviceTypeService.setServiceTypeActive(id, validateStatusBody(req.body)));
}

// GET /orders/:id/maintenance-suggestion
export async function suggestionForOrder(req, res) {
  const orderId = parseId(req.params.id, 'El identificador de la orden');
  sendData(res, await serviceTypeService.suggestionsForOrder(orderId, req.user));
}
