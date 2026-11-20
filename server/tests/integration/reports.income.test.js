import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createPayment } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';

beforeEach(resetTables);
afterAll(closePool);

const pedir = (token, desde, hasta, extra = '') => request(app).get(`/api/reports/income?from=${desde}&to=${hasta}${extra}`).set(bearer(token));
const OCTUBRE = ['2026-10-01', '2026-10-31'];

// Una orden y su administrador para colgar los pagos.
async function base() {
  const escenario = await escenarioOrden('TERMINADO');
  return { orderId: escenario.orden.id, token: escenario.tokens.admin };
}

const pago = (orderId, importe, metodo, fecha, extra = {}) => createPayment({ orderId, amount: importe, method: metodo, paidAt: fecha, ...extra });

describe('qué pagos suman', () => {
  test('solo los PAGADO con paid_at dentro del rango; no PENDIENTE, RECHAZADO ni CANCELADO', async () => {
    const { orderId, token } = await base();
    await pago(orderId, 500, 'EFECTIVO', new Date(2026, 9, 5, 10, 0));
    await pago(orderId, 300, 'TARJETA', new Date(2026, 9, 6, 11, 0));
    await pago(orderId, 999, 'EFECTIVO', new Date(2026, 9, 7, 9, 0), { status: 'PENDIENTE' });
    await pago(orderId, 888, 'EFECTIVO', new Date(2026, 9, 7, 9, 0), { status: 'RECHAZADO' });
    await pago(orderId, 777, 'EFECTIVO', new Date(2026, 9, 7, 9, 0), { status: 'CANCELADO' });

    const res = await pedir(token, ...OCTUBRE);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(800);
    expect(res.body.data.paymentsCount).toBe(2);
  });

  test('los pagos fuera del rango no suman, ni un segundo antes ni un instante después', async () => {
    const { orderId, token } = await base();
    await pago(orderId, 100, 'EFECTIVO', new Date(2026, 8, 30, 23, 59, 59));
    await pago(orderId, 200, 'EFECTIVO', new Date(2026, 9, 1, 0, 0, 0));
    await pago(orderId, 400, 'EFECTIVO', new Date(2026, 9, 31, 23, 59, 59));
    await pago(orderId, 800, 'EFECTIVO', new Date(2026, 10, 1, 0, 0, 0));

    const res = await pedir(token, ...OCTUBRE);

    expect(res.body.data.total).toBe(600);
    expect(res.body.data.paymentsCount).toBe(2);
  });

  test('un pago de las 23:59 entra en su día y no en el siguiente', async () => {
    const { orderId, token } = await base();
    await pago(orderId, 250, 'EFECTIVO', new Date(2026, 9, 14, 23, 59, 0));

    const res = await pedir(token, ...OCTUBRE);

    expect(res.body.data.byDay).toEqual([{ date: '2026-10-14', total: 250 }]);
  });

  test('un rango sin pagos devuelve ceros y listas vacías', async () => {
    const { token } = await base();

    const res = await pedir(token, ...OCTUBRE);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ from: '2026-10-01', to: '2026-10-31', total: 0, paymentsCount: 0, byMethod: [], byDay: [] });
  });
});

describe('desglose y exactitud', () => {
  test('desglosa por método con total y cantidad, y por día en orden', async () => {
    const { orderId, token } = await base();
    await pago(orderId, 500, 'EFECTIVO', new Date(2026, 9, 5, 10, 0));
    await pago(orderId, 250, 'EFECTIVO', new Date(2026, 9, 5, 18, 0));
    await pago(orderId, 300, 'TARJETA', new Date(2026, 9, 3, 11, 0));
    await pago(orderId, 1200, 'TRANSFERENCIA', new Date(2026, 9, 20, 9, 0));

    const { data } = (await pedir(token, ...OCTUBRE)).body;

    expect(data.byMethod).toEqual(
      expect.arrayContaining([
        { method: 'EFECTIVO', total: 750, count: 2 },
        { method: 'TARJETA', total: 300, count: 1 },
        { method: 'TRANSFERENCIA', total: 1200, count: 1 }
      ])
    );
    expect(data.byMethod).toHaveLength(3);
    expect(data.byDay).toEqual([
      { date: '2026-10-03', total: 300 },
      { date: '2026-10-05', total: 750 },
      { date: '2026-10-20', total: 1200 }
    ]);
    expect(data.total).toBe(2250);
  });

  test('el total y los desgloses coinciden centavo por centavo con los pagos consultados directamente', async () => {
    const { orderId, token } = await base();
    const importes = ['100.10', '200.20', '0.30', '33.33', '66.67', '0.01', '1234.56'];
    for (const [i, importe] of importes.entries()) {
      await pago(orderId, importe, i % 2 === 0 ? 'EFECTIVO' : 'MERCADO_PAGO', new Date(2026, 9, 1 + i, 12, 0));
    }

    const { data } = (await pedir(token, ...OCTUBRE)).body;

    const [[directo]] = await pool.query(
      "SELECT ROUND(SUM(amount) * 100) AS centavos FROM payments WHERE status = 'PAGADO' AND paid_at BETWEEN '2026-10-01 00:00:00' AND '2026-10-31 23:59:59'"
    );
    expect(Math.round(data.total * 100)).toBe(Number(directo.centavos));
    expect(data.total).toBe(1635.17);
    expect(Math.round(data.byMethod.reduce((s, m) => s + m.total * 100, 0))).toBe(Number(directo.centavos));
    expect(Math.round(data.byDay.reduce((s, d) => s + d.total * 100, 0))).toBe(Number(directo.centavos));
    expect(data.byMethod.reduce((s, m) => s + m.count, 0)).toBe(data.paymentsCount);
  });

  test('un importe con centavos no pierde precisión por sumas decimales', async () => {
    const { orderId, token } = await base();
    await pago(orderId, '0.10', 'EFECTIVO', new Date(2026, 9, 2, 10, 0));
    await pago(orderId, '0.20', 'EFECTIVO', new Date(2026, 9, 2, 11, 0));

    expect((await pedir(token, ...OCTUBRE)).body.data.total).toBe(0.3);
  });

  test('un solo día (from = to) incluye todo ese día', async () => {
    const { orderId, token } = await base();
    await pago(orderId, 100, 'EFECTIVO', new Date(2026, 9, 5, 0, 0, 1));
    await pago(orderId, 50, 'EFECTIVO', new Date(2026, 9, 5, 23, 59, 59));
    await pago(orderId, 999, 'EFECTIVO', new Date(2026, 9, 6, 0, 0, 0));

    const res = await pedir(token, '2026-10-05', '2026-10-05');

    expect(res.body.data.total).toBe(150);
  });

  test('el reporte nunca expone datos de las órdenes, referencias ni usuarios', async () => {
    const { orderId, token } = await base();
    await pago(orderId, 100, 'TRANSFERENCIA', new Date(2026, 9, 2, 10, 0), { reference: 'SPEI-SECRETO-123' });

    const texto = JSON.stringify((await pedir(token, ...OCTUBRE)).body);

    expect(texto).not.toContain('SPEI-SECRETO-123');
    expect(texto).not.toMatch(/reference|orderId|createdBy|externalReference/);
  });
});

describe('rango inválido', () => {
  test('un rango invertido responde 400 REPORT_RANGE_INVALID', async () => {
    const { token } = await base();
    const res = await pedir(token, '2026-10-31', '2026-10-01');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('REPORT_RANGE_INVALID');
  });

  test('de más de 366 días responde 400 REPORT_RANGE_INVALID, y de 366 exactos se acepta', async () => {
    const { token } = await base();
    const largo = await pedir(token, '2026-01-01', '2027-01-02');
    expect(largo.status).toBe(400);
    expect(largo.body.error.code).toBe('REPORT_RANGE_INVALID');
    expect((await pedir(token, '2026-01-01', '2027-01-01')).status).toBe(200);
  });

  test.each([
    ['una fecha mal escrita', '01/10/2026', '2026-10-31'],
    ['una fecha inexistente', '2026-02-30', '2026-03-31'],
    ['un mes inexistente', '2026-10-01', '2026-13-01']
  ])('%s responde 400 VALIDATION_ERROR con el campo', async (_nombre, desde, hasta) => {
    const { token } = await base();
    const res = await pedir(token, desde, hasta);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  test('sin from o sin to responde 400 VALIDATION_ERROR', async () => {
    const { token } = await base();
    for (const consulta of ['?to=2026-10-31', '?from=2026-10-01', '']) {
      const res = await request(app).get(`/api/reports/income${consulta}`).set(bearer(token));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  test('un format desconocido responde 400', async () => {
    const { token } = await base();
    expect((await pedir(token, ...OCTUBRE, '&format=xml')).status).toBe(400);
  });
});

describe('permisos', () => {
  test.each(['RECEPTIONIST', 'MECHANIC'])('el rol %s recibe 403 FORBIDDEN', async (rol) => {
    const { token } = await loginAs(rol);
    const res = await pedir(token, ...OCTUBRE);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('sin token responde 401', async () => {
    expect((await request(app).get('/api/reports/income?from=2026-10-01&to=2026-10-31')).status).toBe(401);
  });

  test('el reporte no tiene rutas para escribir', async () => {
    const { token } = await loginAs('ADMIN');
    for (const metodo of ['post', 'put', 'patch', 'delete']) {
      expect((await request(app)[metodo]('/api/reports/income').set(bearer(token)).send({})).status).toBe(404);
    }
  });
});
