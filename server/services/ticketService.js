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
import { PAYABLE_STATUSES } from './paymentRules.js';
import { nextTicketFolio } from './ticketFolio.js';

const money = (value) => Math.round(Number(value) * 100) / 100;

// Arma el ticket con los datos vigentes de la orden, el cliente, el vehículo y los pagos. No guarda copia del contenido:
// si la orden cambia después, el ticket muestra lo vigente y avisa con `orderChangedSinceGenerated`.
async function buildTicket(head) {
  const order = await orderModel.findById(head.orderId);
  const [client, vehicle, services, labor, parts, payments] = await Promise.all([
    clientModel.findById(order.clientId),
    vehicleModel.findById(order.vehicleId),
    orderItemModel.listServices(order.id),
    orderItemModel.listLabor(order.id),
    orderPartModel.listByOrder(order.id),
    paymentModel.listByOrder(order.id)
  ]);
  const toLine = (line) => ({ description: line.description, quantity: 1, unitPrice: line.amount, amount: line.amount });
  return {
    id: head.id,
    folio: head.folio,
    generatedAt: head.generatedAt,
    generatedByName: head.generatedByName,
    orderChangedSinceGenerated: money(order.total) !== money(head.orderTotal),
    workshop: { name: env.workshop.name, address: env.workshop.address, phone: env.workshop.phone },
    order: { id: order.id, folio: order.folio, status: order.status },
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
    total: order.total,
    // Los pagos rechazados y cancelados no forman parte del comprobante.
    payments: payments.filter((payment) => payment.status === 'PAGADO' || payment.status === 'PENDIENTE'),
    paymentSummary: order.payment
  };
}

// Genera el ticket de una orden TERMINADO o ENTREGADO, o devuelve el existente. Se bloquea la orden para que dos
// solicitudes simultáneas produzcan un solo ticket. Devuelve { ticket, created }.
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
      { folio: await nextTicketFolio(conn), orderId, orderTotal: order.total, generatedBy: actor.id },
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
