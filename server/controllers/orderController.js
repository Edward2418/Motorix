import * as orderService from '../services/orderService.js';
import { validateMechanicChange, validateOrderCreate } from '../validators/orderValidator.js';
import { parseId } from '../validators/common.js';
import { sendData } from '../utils/response.js';

const orderId = (req) => parseId(req.params.id, 'El identificador de la orden');

export async function create(req, res) {
  const input = validateOrderCreate(req.body);
  sendData(res, await orderService.createOrder(input, req.user), 201);
}

export async function get(req, res) {
  sendData(res, await orderService.getOrder(orderId(req), req.user));
}

export async function reassignMechanic(req, res) {
  const id = orderId(req);
  const { mechanicId } = validateMechanicChange(req.body);
  sendData(res, await orderService.reassignMechanic(id, mechanicId, req.user));
}
