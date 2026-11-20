import { query } from '../config/db.js';

// Consultas de los reportes (Sprint 7). Solo leen; todas con parámetros. Los importes salen en centavos enteros
// (`ROUND(SUM(amount) * 100)`) para sumar sin errores de redondeo.

/** Pagos cobrados (PAGADO) con `paid_at` dentro de `[start, end]`, por método: `{ method, cents, count }`. */
export async function incomeByMethod({ start, end }, conn) {
  const rows = await query(
    `SELECT method, ROUND(SUM(amount) * 100) AS cents, COUNT(*) AS count
     FROM payments
     WHERE status = 'PAGADO' AND paid_at >= ? AND paid_at <= ?
     GROUP BY method
     ORDER BY method`,
    [start, end],
    conn
  );
  return rows.map((row) => ({ method: row.method, cents: Number(row.cents), count: Number(row.count) }));
}

/** Los mismos pagos por día local de cobro: `{ date: 'AAAA-MM-DD', cents }`, del más antiguo al más reciente. */
export async function incomeByDay({ start, end }, conn) {
  const rows = await query(
    `SELECT DATE_FORMAT(paid_at, '%Y-%m-%d') AS day, ROUND(SUM(amount) * 100) AS cents
     FROM payments
     WHERE status = 'PAGADO' AND paid_at >= ? AND paid_at <= ?
     GROUP BY day
     ORDER BY day`,
    [start, end],
    conn
  );
  return rows.map((row) => ({ date: row.day, cents: Number(row.cents) }));
}
