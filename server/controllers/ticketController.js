import * as ticketService from '../services/ticketService.js';
import { parseId } from '../validators/common.js';
import { sendData } from '../utils/response.js';

const orderId = (req) => parseId(req.params.id, 'El identificador de la orden');

// 201 al crear el ticket y 200 si ya existía (devuelve el mismo folio).
export async function generate(req, res) {
  const { ticket, created } = await ticketService.generateTicket(orderId(req), req.user);
  sendData(res, ticket, created ? 201 : 200);
}

export async function get(req, res) {
  sendData(res, await ticketService.getTicket(orderId(req)));
}
