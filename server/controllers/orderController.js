import * as orderService from '../services/orderService.js';
import {
  validateLine,
  validateMechanicChange,
  validateOrderContent,
  validateOrderCreate,
  validateOrderListQuery
} from '../validators/orderValidator.js';
import { parseId } from '../validators/common.js';
import { sendData, sendPage } from '../utils/response.js';

const orderId = (req) => parseId(req.params.id, 'El identificador de la orden');

export async function list(req, res) {
  sendPage(res, await orderService.listOrders(validateOrderListQuery(req.query), req.user));
}

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

export async function updateContent(req, res) {
  const id = orderId(req);
  sendData(res, await orderService.updateContent(id, validateOrderContent(req.body), req.user));
}

// Los controladores de servicios y de mano de obra son iguales: cambia solo el tipo de línea.
const lineId = (req) => parseId(req.params.lineId, 'El identificador de la línea');

export const addLine = (kind) => async (req, res) => {
  const id = orderId(req);
  sendData(res, await orderService.addLine(kind, id, validateLine(req.body), req.user), 201);
};

export const updateLine = (kind) => async (req, res) => {
  const id = orderId(req);
  const line = lineId(req);
  sendData(res, await orderService.updateLine(kind, id, line, validateLine(req.body), req.user));
};

export const removeLine = (kind) => async (req, res) => {
  const id = orderId(req);
  const line = lineId(req);
  sendData(res, await orderService.removeLine(kind, id, line, req.user));
};
