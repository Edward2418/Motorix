import { withTransaction } from '../config/db.js';
import * as orderModel from '../models/orderModel.js';
import * as paymentModel from '../models/paymentModel.js';
import { AppError } from '../utils/AppError.js';
import { canRegister } from './paymentRules.js';

// Métodos disponibles y si Mercado Pago está configurado en el servidor (se completa con la pasarela en la Historia 3).
export function getConfig() {
  return { methods: ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'MERCADO_PAGO'], mercadoPagoEnabled: false };
}

// Resumen de pagos de una orden con los datos vigentes (usa la conexión de la transacción si se da).
export async function summaryOf(orderId, conn) {
  const order = await orderModel.findById(orderId, conn);
  return order.payment;
}

async function requireOrder(orderId) {
  const order = await orderModel.findById(orderId);
  if (!order) {
    throw AppError.notFound('La orden no existe.');
  }
  return order;
}

// Pagos de una orden (también los cancelados y rechazados) con su resumen.
export async function listOrderPayments(orderId) {
  const order = await requireOrder(orderId);
  return { payments: await paymentModel.listByOrder(orderId), summary: order.payment };
}

// Registra un pago. Se bloquea la fila de la orden para que dos pagos simultáneos no superen el importe disponible.
export async function registerPayment(orderId, input, actor) {
  const paymentId = await withTransaction(async (conn) => {
    const locked = await orderModel.lockById(orderId, conn);
    if (!locked) {
      throw AppError.notFound('La orden no existe.');
    }
    const order = await orderModel.findById(orderId, conn);
    const decision = canRegister({ orderStatus: order.status, summary: order.payment, amount: input.amount });
    if (!decision.ok) {
      if (decision.code === 'AMOUNT_EXCEEDS_BALANCE') {
        throw AppError.amountExceedsBalance(decision.available);
      }
      throw AppError.orderNotPayable(decision.reason);
    }
    if (input.method === 'MERCADO_PAGO') {
      throw AppError.mercadoPagoNotConfigured();
    }
    return paymentModel.insert(
      {
        orderId,
        amount: input.amount,
        method: input.method,
        status: 'PAGADO',
        reference: input.reference,
        createdBy: actor.id
      },
      conn
    );
  });
  return { payment: await paymentModel.findById(paymentId), summary: await summaryOf(orderId) };
}

// Cancela un pago con motivo. Recepción solo cancela pagos pendientes; solo administración cancela los cobrados.
export async function cancelPayment(paymentId, { reason }, actor) {
  const found = await paymentModel.findRawById(paymentId);
  if (!found) {
    throw AppError.notFound('El pago no existe.');
  }
  await withTransaction(async (conn) => {
    await orderModel.lockById(found.order_id, conn);
    const current = await paymentModel.findRawById(paymentId, conn);
    if (current.status === 'RECHAZADO' || current.status === 'CANCELADO') {
      throw AppError.paymentNotCancellable(`El pago ya está ${current.status === 'CANCELADO' ? 'cancelado' : 'rechazado'}.`);
    }
    if (current.status === 'PAGADO' && actor.role !== 'ADMIN') {
      throw AppError.forbidden('Solo administración puede cancelar un pago ya cobrado.');
    }
    const applied = await paymentModel.markCancelled(paymentId, [current.status], { reason, cancelledBy: actor.id }, conn);
    if (!applied) {
      throw AppError.paymentNotCancellable('El pago cambió de estado mientras se cancelaba. Revisa su estado actual.');
    }
  });
  return { payment: await paymentModel.findById(paymentId), summary: await summaryOf(found.order_id) };
}
