import * as paymentService from '../services/paymentService.js';
import { validatePaymentCancel, validatePaymentCreate } from '../validators/paymentValidator.js';
import { parseId } from '../validators/common.js';
import { sendData } from '../utils/response.js';

export async function config(req, res) {
  sendData(res, paymentService.getConfig());
}

export async function listByOrder(req, res) {
  sendData(res, await paymentService.listOrderPayments(parseId(req.params.id, 'El identificador de la orden')));
}

export async function create(req, res) {
  const orderId = parseId(req.params.id, 'El identificador de la orden');
  sendData(res, await paymentService.registerPayment(orderId, validatePaymentCreate(req.body), req.user), 201);
}

export async function cancel(req, res) {
  const paymentId = parseId(req.params.id, 'El identificador del pago');
  sendData(res, await paymentService.cancelPayment(paymentId, validatePaymentCancel(req.body), req.user));
}
