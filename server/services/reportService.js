import * as reportModel from '../models/reportModel.js';
import { centsToPesos } from './reportRules.js';

// Reportes de solo lectura para administración (Sprint 7). Cada reporte calcula en centavos y devuelve pesos.

/**
 * Ingresos del rango: total, cantidad de pagos, desglose por método de pago y por día. Los totales son suma de los
 * desgloses, así que coinciden entre sí y con los pagos que los originan.
 */
export async function income({ from, to, start, end }) {
  const [byMethod, byDay] = await Promise.all([reportModel.incomeByMethod({ start, end }), reportModel.incomeByDay({ start, end })]);
  const totalCents = byMethod.reduce((sum, row) => sum + row.cents, 0);
  return {
    from,
    to,
    total: centsToPesos(totalCents),
    paymentsCount: byMethod.reduce((sum, row) => sum + row.count, 0),
    byMethod: byMethod.map((row) => ({ method: row.method, total: centsToPesos(row.cents), count: row.count })),
    byDay: byDay.map((row) => ({ date: row.date, total: centsToPesos(row.cents) }))
  };
}
