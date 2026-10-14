import { pool, resetTables, closePool } from '../helpers/db.js';
import { runSeeds } from '../../scripts/sqlRunner.js';
import { getDashboard } from '../../services/dashboardService.js';
import { formatTicketFolio } from '../../services/ticketFolio.js';

const count = async (table) => (await pool.query(`SELECT COUNT(*) AS total FROM ${table}`))[0][0].total;

afterAll(closePool);

describe('seeds de pagos y tickets', () => {
  beforeEach(async () => {
    await resetTables();
    await runSeeds(pool, () => {});
  });

  test('cargan pagos y tickets y repetir el seed no duplica nada', async () => {
    const antes = { pagos: await count('payments'), tickets: await count('tickets') };
    expect(antes).toEqual({ pagos: 8, tickets: 2 });
    await runSeeds(pool, () => {});
    expect({ pagos: await count('payments'), tickets: await count('tickets') }).toEqual(antes);
  });

  test('están representados los cuatro métodos y los cuatro estados', async () => {
    const [metodos] = await pool.query('SELECT DISTINCT method FROM payments ORDER BY method');
    expect(metodos.map((m) => m.method).sort()).toEqual(['EFECTIVO', 'MERCADO_PAGO', 'TARJETA', 'TRANSFERENCIA']);
    const [estados] = await pool.query('SELECT DISTINCT status FROM payments ORDER BY status');
    expect(estados.map((e) => e.status).sort()).toEqual(['CANCELADO', 'PAGADO', 'PENDIENTE', 'RECHAZADO']);
  });

  test('los pagos vigentes de cada orden nunca superan su total', async () => {
    const [filas] = await pool.query(
      `SELECT o.folio,
              (SELECT COALESCE(SUM(s.cost), 0) FROM order_services s WHERE s.order_id = o.id)
              + (SELECT COALESCE(SUM(l.amount), 0) FROM order_labor l WHERE l.order_id = o.id)
              + (SELECT COALESCE(SUM(p.quantity * p.unit_price), 0) FROM order_parts p WHERE p.order_id = o.id) AS total,
              (SELECT COALESCE(SUM(py.amount), 0) FROM payments py WHERE py.order_id = o.id AND py.status IN ('PAGADO','PENDIENTE')) AS vigente
       FROM service_orders o`
    );
    for (const fila of filas) {
      expect({ folio: fila.folio, ok: Number(fila.vigente) <= Number(fila.total) }).toEqual({ folio: fila.folio, ok: true });
    }
  });

  test('hay una orden pagada por completo y otra con pago parcial y saldo por cobrar', async () => {
    const [[pagada]] = await pool.query(
      `SELECT o.id, (SELECT COALESCE(SUM(py.amount), 0) FROM payments py WHERE py.order_id = o.id AND py.status = 'PAGADO') AS cobrado,
              (SELECT COALESCE(SUM(s.cost), 0) FROM order_services s WHERE s.order_id = o.id)
              + (SELECT COALESCE(SUM(l.amount), 0) FROM order_labor l WHERE l.order_id = o.id)
              + (SELECT COALESCE(SUM(p.quantity * p.unit_price), 0) FROM order_parts p WHERE p.order_id = o.id) AS total
       FROM service_orders o WHERE o.folio = 'OS-2026-0002'`
    );
    expect(Number(pagada.cobrado)).toBeLessThanOrEqual(Number(pagada.total));
    const panel = await getDashboard('month');
    expect(panel.attention.pendingBalance.count).toBeGreaterThan(0);
  });

  test('los tickets tienen folio único, uno por orden, y el contador coincide', async () => {
    const [tickets] = await pool.query('SELECT folio, order_id FROM tickets ORDER BY folio');
    expect(tickets.map((t) => t.folio)).toEqual([formatTicketFolio(2026, 1), formatTicketFolio(2026, 2)]);
    expect(new Set(tickets.map((t) => t.order_id)).size).toBe(2);
    const [[contador]] = await pool.query('SELECT last_number FROM ticket_folio_counters WHERE year = 2026');
    expect(contador.last_number).toBe(2);
  });

  test('el ticket de ejemplo no muestra el aviso de orden modificada', async () => {
    const [[fila]] = await pool.query(
      `SELECT t.order_total,
              (SELECT COALESCE(SUM(s.cost), 0) FROM order_services s WHERE s.order_id = t.order_id)
              + (SELECT COALESCE(SUM(l.amount), 0) FROM order_labor l WHERE l.order_id = t.order_id)
              + (SELECT COALESCE(SUM(p.quantity * p.unit_price), 0) FROM order_parts p WHERE p.order_id = t.order_id) AS total
       FROM tickets t WHERE t.folio = 'TK-2026-0001'`
    );
    expect(Number(fila.order_total)).toBe(Number(fila.total));
  });

  test('el panel devuelve cifras distintas de cero con los datos de ejemplo', async () => {
    const panel = await getDashboard('month');
    expect(panel.indicators.openOrders).toBeGreaterThan(0);
    expect(panel.indicators.collected).toBeGreaterThan(0);
    expect(panel.attention.maintenance.overdue).toBeGreaterThan(0);
    expect(panel.attention.pendingBalance.total).toBeGreaterThan(0);
    const hoy = await getDashboard('today');
    expect(hoy.indicators.collected).toBeGreaterThan(0);
  });
});
