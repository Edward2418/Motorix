import * as orderPartService from '../services/orderPartService.js';
import {
  validateOrderPartAdd,
  validateOrderPartQuantity,
  validateOrderPartRemove
} from '../validators/orderPartValidator.js';
import { parseId } from '../validators/common.js';
import { sendData } from '../utils/response.js';

const orderId = (req) => parseId(req.params.id, 'El identificador de la orden');
const lineId = (req) => parseId(req.params.lineId, 'El identificador de la línea');

export async function add(req, res) {
  const id = orderId(req);
  sendData(res, await orderPartService.addPart(id, validateOrderPartAdd(req.body), req.user), 201);
}

export async function updateQuantity(req, res) {
  const id = orderId(req);
  const line = lineId(req);
  sendData(res, await orderPartService.updatePartQuantity(id, line, validateOrderPartQuantity(req.body), req.user));
}

export async function remove(req, res) {
  const id = orderId(req);
  const line = lineId(req);
  sendData(res, await orderPartService.removePart(id, line, validateOrderPartRemove(req.body), req.user));
}
