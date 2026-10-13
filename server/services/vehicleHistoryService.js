import * as vehicleHistoryModel from '../models/vehicleHistoryModel.js';
import * as vehicleModel from '../models/vehicleModel.js';
import { AppError } from '../utils/AppError.js';

const money = (value) => Math.round(value * 100) / 100;

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
    const sum = (items, value) => items.reduce((acc, item) => acc + value(item), 0);
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
      total: money(
        sum(services, (s) => s.amount) + sum(labor, (l) => l.amount) + sum(parts, (p) => p.quantity * p.unitPrice)
      )
    };
  });
  return { data, page, pageSize, total };
}
