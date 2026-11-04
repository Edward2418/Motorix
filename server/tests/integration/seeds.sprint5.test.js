import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool } from '../helpers/db.js';
import { bearer, loginAs } from '../helpers/auth.js';
import { runSeeds } from '../../scripts/sqlRunner.js';

afterAll(closePool);

const count = async (table) => (await pool.query(`SELECT COUNT(*) AS total FROM ${table}`))[0][0].total;
const ordenPorFolio = async (folio) => (await pool.query('SELECT * FROM service_orders WHERE folio = ?', [folio]))[0][0];
const totalDeLaOrden = async (orderId) => {
  const [[fila]] = await pool.query(
    `SELECT (SELECT COALESCE(SUM(cost), 0) FROM order_services WHERE order_id = ?)
          + (SELECT COALESCE(SUM(amount), 0) FROM order_labor WHERE order_id = ?)
          + (SELECT COALESCE(SUM(quantity * unit_price), 0) FROM order_parts WHERE order_id = ?) AS total`,
    [orderId, orderId, orderId]
  );
  return Number(fila.total);
};

describe('datos de ejemplo del Sprint 5 (seed 010)', () => {
  beforeEach(async () => {
    await resetTables();
    await runSeeds(pool, () => {});
  });

  test('hay una orden terminada con servicios, mano de obra y refacciones con precio, sin pagos ni ticket, cobrable por su total', async () => {
    const orden = await ordenPorFolio('OS-2026-0009');
    expect(orden.status).toBe('TERMINADO');
    expect((await pool.query('SELECT COUNT(*) AS total FROM order_services WHERE order_id = ?', [orden.id]))[0][0].total).toBeGreaterThan(0);
    expect((await pool.query('SELECT COUNT(*) AS total FROM order_labor WHERE order_id = ?', [orden.id]))[0][0].total).toBeGreaterThan(0);
    const [lineas] = await pool.query('SELECT unit_price FROM order_parts WHERE order_id = ?', [orden.id]);
    expect(lineas.length).toBeGreaterThan(0);
    for (const linea of lineas) {
      expect(Number(linea.unit_price)).toBeGreaterThan(0);
    }
    expect((await pool.query('SELECT COUNT(*) AS total FROM payments WHERE order_id = ?', [orden.id]))[0][0].total).toBe(0);
    expect((await pool.query('SELECT COUNT(*) AS total FROM tickets WHERE order_id = ?', [orden.id]))[0][0].total).toBe(0);

    const total = await totalDeLaOrden(orden.id);
    expect(total).toBeGreaterThan(0);
    const { token } = await loginAs('RECEPTIONIST', { username: 'recepcion.pruebas' });
    const cobro = await request(app).post(`/api/orders/${orden.id}/payments`).set(bearer(token)).send({ amount: total, method: 'EFECTIVO' });
    expect(cobro.status).toBe(201);
    expect(cobro.body.data.summary).toMatchObject({ total, collected: total, status: 'PAGADA' });
  });

  test('hay otra orden terminada con refacciones y un ticket con su contenido guardado, sin pagos', async () => {
    const orden = await ordenPorFolio('OS-2026-0010');
    expect(orden.status).toBe('TERMINADO');
    expect((await pool.query('SELECT COUNT(*) AS total FROM order_parts WHERE order_id = ?', [orden.id]))[0][0].total).toBeGreaterThan(0);
    expect((await pool.query('SELECT COUNT(*) AS total FROM payments WHERE order_id = ?', [orden.id]))[0][0].total).toBe(0);

    const [[ticket]] = await pool.query('SELECT folio, order_total, content FROM tickets WHERE order_id = ?', [orden.id]);
    expect(ticket.folio).toBe('TK-2026-0003');
    expect(ticket.content).not.toBeNull();
    const contenido = typeof ticket.content === 'string' ? JSON.parse(ticket.content) : ticket.content;
    const total = await totalDeLaOrden(orden.id);
    expect(Number(ticket.order_total)).toBe(total);
    expect(Number(contenido.total)).toBe(total);
    expect(contenido.order).toEqual({ id: orden.id, folio: 'OS-2026-0010' });
    expect(contenido.parts.length).toBeGreaterThan(0);
    expect(contenido.services.length).toBeGreaterThan(0);
    expect(contenido).not.toHaveProperty('payments');

    // La API lo devuelve tal como se guardó y sin el aviso de orden modificada.
    const { token } = await loginAs('ADMIN', { username: 'admin.pruebas' });
    const res = await request(app).get(`/api/orders/${orden.id}/ticket`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ folio: 'TK-2026-0003', total, orderChangedSinceGenerated: false });
    expect(res.body.data.parts).toHaveLength(contenido.parts.length);
  });

  test('los pagos y tickets de los seeds anteriores conservan su importe y su contenido (total de creación y contenido en NULL)', async () => {
    const pagos = (await pool.query('SELECT COUNT(*) AS total FROM payments'))[0][0].total;
    expect(pagos).toBe(8);
    expect((await pool.query('SELECT COUNT(*) AS total FROM payments WHERE order_total_at_creation IS NOT NULL'))[0][0].total).toBe(0);
    const [anteriores] = await pool.query("SELECT folio, content FROM tickets WHERE folio IN ('TK-2026-0001', 'TK-2026-0002') ORDER BY folio");
    expect(anteriores.map((t) => t.folio)).toEqual(['TK-2026-0001', 'TK-2026-0002']);
    for (const ticket of anteriores) {
      expect(ticket.content).toBeNull();
    }
  });

  test('cargar los seeds de nuevo no duplica ningún registro ni cambia el stock', async () => {
    const tablas = ['service_orders', 'order_services', 'order_labor', 'order_parts', 'order_status_history', 'inventory_movements', 'tickets', 'payments', 'parts'];
    const antes = {};
    for (const tabla of tablas) {
      antes[tabla] = await count(tabla);
    }
    const stockAntes = (await pool.query('SELECT code, stock FROM parts ORDER BY id'))[0];
    await runSeeds(pool, () => {});
    for (const tabla of tablas) {
      expect({ tabla, total: await count(tabla) }).toEqual({ tabla, total: antes[tabla] });
    }
    expect((await pool.query('SELECT code, stock FROM parts ORDER BY id'))[0]).toEqual(stockAntes);
  });

  test('el stock de cada refacción sigue siendo la suma de sus movimientos y nunca es negativo', async () => {
    const [filas] = await pool.query(
      `SELECT p.code, p.stock, COALESCE((SELECT SUM(m.quantity) FROM inventory_movements m WHERE m.part_id = p.id), 0) AS suma
       FROM parts p`
    );
    for (const fila of filas) {
      expect({ code: fila.code, stock: Number(fila.stock), suma: Number(fila.suma) }).toEqual({
        code: fila.code,
        stock: Number(fila.suma),
        suma: Number(fila.suma)
      });
      expect(Number(fila.stock)).toBeGreaterThanOrEqual(0);
    }
  });

  test('el kilometraje actual de cada vehículo no baja del kilometraje del servicio de sus órdenes', async () => {
    const [filas] = await pool.query(
      `SELECT o.folio, v.current_mileage, o.service_mileage
       FROM service_orders o JOIN vehicles v ON v.id = o.vehicle_id
       WHERE o.service_mileage IS NOT NULL`
    );
    for (const fila of filas) {
      expect({ folio: fila.folio, ok: Number(fila.current_mileage) >= Number(fila.service_mileage) }).toEqual({ folio: fila.folio, ok: true });
    }
  });
});
