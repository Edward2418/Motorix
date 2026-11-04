import { env } from '../config/env.js';
import { withTransaction } from '../config/db.js';
import * as clientModel from '../models/clientModel.js';
import * as orderItemModel from '../models/orderItemModel.js';
import * as orderModel from '../models/orderModel.js';
import * as orderPartModel from '../models/orderPartModel.js';
import * as paymentModel from '../models/paymentModel.js';
import * as ticketModel from '../models/ticketModel.js';
import * as vehicleModel from '../models/vehicleModel.js';
import { AppError } from '../utils/AppError.js';
import { toCents } from '../utils/money.js';
import { PAYABLE_STATUSES } from './paymentRules.js';
import { nextTicketFolio } from './ticketFolio.js';

// Contenido del ticket: lo que describe el servicio cobrado (taller, cliente, vehículo, líneas, subtotales y total).
// No incluye los pagos ni el estado de la orden: esos se leen vigentes cada vez que se consulta el ticket.
async function buildContent(order, conn) {
  const [client, vehicle, services, labor, parts] = await Promise.all([
    clientModel.findById(order.clientId, conn),
    vehicleModel.findById(order.vehicleId, conn),
    orderItemModel.listServices(order.id, conn),
    orderItemModel.listLabor(order.id, conn),
    orderPartModel.listByOrder(order.id, conn)
  ]);
  const toLine = (line) => ({ description: line.description, quantity: 1, unitPrice: line.amount, amount: line.amount });
  return {
    workshop: { name: env.workshop.name, address: env.workshop.address, phone: env.workshop.phone },
    order: { id: order.id, folio: order.folio },
    client: { name: client.name, phone: client.phone },
    vehicle: {
      description: `${vehicle.brand} ${vehicle.model} ${vehicle.year}`,
      licensePlate: vehicle.licensePlate,
      mileage: order.serviceMileage ?? order.entryMileage
    },
    services: services.map(toLine),
    labor: labor.map(toLine),
    parts: parts.map((part) => ({
      description: `${part.code} · ${part.name}`,
      quantity: part.quantity,
      unitPrice: part.unitPrice,
      amount: part.subtotal
    })),
    subtotals: { services: order.servicesTotal, labor: order.laborTotal, parts: order.partsTotal },
    total: order.total
  };
}

// Arma el ticket para responder. Un ticket emitido desde el Sprint 5 trae su contenido guardado y se muestra siempre
// tal como se emitió; uno anterior (sin contenido) se arma con los datos vigentes de la orden, como antes. En ambos
// casos los pagos y su estado son vigentes y se indica con `orderChangedSinceGenerated` si el total de la orden ya no
// coincide con el que tenía al emitirse.
async function buildTicket(head) {
  const order = await orderModel.findById(head.orderId);
  const payments = await paymentModel.listByOrder(order.id);
  const content = head.content ?? (await buildContent(order));
  // El aviso de pago desfasado es de la orden y de los pagos, no del comprobante: el ticket conserva su forma.
  const { hasOutdatedPending, ...paymentSummary } = order.payment;
  return {
    id: head.id,
    folio: head.folio,
    generatedAt: head.generatedAt,
    generatedByName: head.generatedByName,
    orderChangedSinceGenerated: toCents(order.total) !== toCents(head.orderTotal),
    ...content,
    // El estado de la orden no se guarda en el ticket: se lee vigente.
    order: { ...content.order, status: order.status },
    // Los pagos rechazados y cancelados no forman parte del comprobante.
    payments: payments.filter((payment) => payment.status === 'PAGADO' || payment.status === 'PENDIENTE'),
    paymentSummary
  };
}

// Genera el ticket de una orden TERMINADO o ENTREGADO, o devuelve el existente. Se bloquea la orden para que dos
// solicitudes simultáneas produzcan un solo ticket y un solo contenido guardado. Devuelve { ticket, created }.
export async function generateTicket(orderId, actor) {
  const { head, created } = await withTransaction(async (conn) => {
    const locked = await orderModel.lockById(orderId, conn);
    if (!locked) {
      throw AppError.notFound('La orden no existe.');
    }
    if (!PAYABLE_STATUSES.includes(locked.status)) {
      throw AppError.orderNotTicketable(locked.status);
    }
    const existing = await ticketModel.findByOrder(orderId, conn);
    if (existing) {
      return { head: existing, created: false };
    }
    const order = await orderModel.findById(orderId, conn);
    await ticketModel.insert(
      {
        folio: await nextTicketFolio(conn),
        orderId,
        orderTotal: order.total,
        content: await buildContent(order, conn),
        generatedBy: actor.id
      },
      conn
    );
    return { head: await ticketModel.findByOrder(orderId, conn), created: true };
  });
  return { ticket: await buildTicket(head), created };
}

// Consulta el ticket de una orden (404 si la orden no existe o todavía no tiene ticket).
export async function getTicket(orderId) {
  const order = await orderModel.findById(orderId);
  if (!order) {
    throw AppError.notFound('La orden no existe.');
  }
  const head = await ticketModel.findByOrder(orderId);
  if (!head) {
    throw AppError.ticketNotFound();
  }
  return buildTicket(head);
}
