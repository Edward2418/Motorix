import { withTransaction } from '../config/db.js';
import * as orderModel from '../models/orderModel.js';
import * as paymentModel from '../models/paymentModel.js';
import { AppError } from '../utils/AppError.js';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { getPaymentGateway } from './gateways/paymentGateway.js';
import { resolveStatus } from './gateways/mercadoPagoStatus.js';
import { canRegister } from './paymentRules.js';

// Métodos disponibles y si Mercado Pago está configurado en el servidor (hay credenciales).
export function getConfig() {
  return { methods: ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'MERCADO_PAGO'], mercadoPagoEnabled: getPaymentGateway().enabled };
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
  const gateway = getPaymentGateway();
  if (input.method === 'MERCADO_PAGO' && !gateway.enabled) {
    throw AppError.mercadoPagoNotConfigured();
  }
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
      // Primero se crea la preferencia en el servicio externo; solo si responde se guarda el pago pendiente, que
      // reserva su importe. Si el servicio falla (503) no queda ningún pago. La orden sigue bloqueada, así que otro
      // pago simultáneo no puede reservar el mismo importe.
      const externalReference = `mtx-${randomUUID()}`;
      const expiresAt = new Date(Date.now() + env.payments.paymentLinkHours * 3600000);
      const { preferenceId, link } = await gateway.createPaymentLink({
        externalReference,
        amount: input.amount,
        description: `Orden ${order.folio}`,
        expiresAt
      });
      return paymentModel.insert(
        {
          orderId,
          amount: input.amount,
          method: input.method,
          status: 'PENDIENTE',
          reference: input.reference,
          externalReference,
          externalPreferenceId: preferenceId,
          paymentLink: link,
          expiresAt,
          createdBy: actor.id
        },
        conn
      );
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

// Actualiza un pago de Mercado Pago consultando al servicio externo (sin webhook). Es idempotente: consultar de nuevo
// un pago ya resuelto no cambia nada. Devuelve { payment, summary, warning }.
export async function refreshPayment(paymentId) {
  const found = await paymentModel.findRawById(paymentId);
  if (!found) {
    throw AppError.notFound('El pago no existe.');
  }
  if (found.method !== 'MERCADO_PAGO') {
    throw AppError.paymentNotRefreshable();
  }
  const respond = async (warning = null) => ({
    payment: await paymentModel.findById(paymentId),
    summary: await summaryOf(found.order_id),
    warning
  });
  if (found.status === 'PAGADO') {
    return respond();
  }
  const gateway = getPaymentGateway();
  if (!gateway.enabled) {
    throw AppError.mercadoPagoNotConfigured();
  }

  // Se consulta fuera de la transacción: no se mantiene bloqueada la orden mientras se espera al servicio externo.
  const results = await gateway.findPayments(found.external_reference);

  if (found.status !== 'PENDIENTE') {
    // Un pago cancelado o rechazado no cambia, pero si el servicio reporta un cobro aprobado se avisa para conciliarlo.
    const approved = results.some((result) => result.status === 'approved');
    return respond(approved ? 'EXTERNAL_APPROVED' : null);
  }

  const decision = resolveStatus({ results, now: new Date(), expiresAt: found.expires_at });
  if (decision.status === 'PENDIENTE') {
    return respond('STILL_PENDING');
  }
  await withTransaction(async (conn) => {
    await orderModel.lockById(found.order_id, conn);
    // Si otra operación (cancelar o actualizar a la vez) ya cambió el pago, el cambio condicional no se aplica.
    await paymentModel.markResolved(
      paymentId,
      {
        status: decision.status,
        paidAt: decision.status === 'PAGADO' ? new Date() : null,
        externalPaymentId: decision.externalPaymentId
      },
      conn
    );
  });
  return respond();
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
