import * as vehicleHistoryModel from '../models/vehicleHistoryModel.js';
import * as vehicleModel from '../models/vehicleModel.js';
import { AppError } from '../utils/AppError.js';
import { fromCents, sumCents, toCents } from '../utils/money.js';

const groupBy = (items, orderId) => items.filter((item) => item.orderId === orderId);
const withoutOrder = ({ orderId, ...rest }) => rest;

// Historial de servicios de un vehículo, derivado de sus órdenes finalizadas. Solo lectura para los tres roles.
export async function getHistory(vehicleId, { page, pageSize }) {
  if (!(await vehicleModel.findById(vehicleId))) {
    throw AppError.notFound('El vehículo no existe.');
  }
  const { rows, total } = await vehicleHistoryModel.listFinished(vehicleId, { page, pageSize });
  const lines = await vehicleHistoryModel.listLinesByOrders(rows.map((row) => row.id));

  const data = rows.map((row) => {
    const services = groupBy(lines.services, row.id).map(withoutOrder);
    const labor = groupBy(lines.labor, row.id).map(withoutOrder);
    const parts = groupBy(lines.parts, row.id).map(withoutOrder);
    // Importes en centavos enteros: el total del historial coincide con la suma exacta de sus líneas.
    const centsOf = (items, value) => sumCents(items.map((item) => value(item)));
    return {
      orderId: row.id,
      folio: row.folio,
      status: row.status,
      serviceDate: row.service_date,
      serviceMileage: row.service_mileage,
      mechanicName: row.mechanic_name,
      reportedProblem: row.reported_problem,
      diagnosis: row.diagnosis,
      notes: row.notes,
      recommendations: row.recommendations,
      services,
      labor,
      parts,
      total: fromCents(
        centsOf(services, (s) => toCents(s.amount)) +
          centsOf(labor, (l) => toCents(l.amount)) +
          centsOf(parts, (p) => p.quantity * toCents(p.unitPrice))
      )
    };
  });
  return { data, page, pageSize, total };
}
