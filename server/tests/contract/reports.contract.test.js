import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createPayment } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';

beforeEach(resetTables);
afterAll(closePool);

describe('contrato de GET /api/reports/income', () => {
  test('responde 200 con { data: IncomeReport }', async () => {
    const { orden, tokens } = await escenarioOrden('TERMINADO');
    await createPayment({ orderId: orden.id, amount: 500.5, method: 'EFECTIVO', paidAt: new Date(2026, 9, 5, 10, 0) });
    await createPayment({ orderId: orden.id, amount: 300, method: 'TARJETA', paidAt: new Date(2026, 9, 6, 10, 0) });

    const res = await request(app).get('/api/reports/income?from=2026-10-01&to=2026-10-31').set(bearer(tokens.admin));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({
      data: {
        from: '2026-10-01',
        to: '2026-10-31',
        total: 800.5,
        paymentsCount: 2,
        byMethod: expect.arrayContaining([
          { method: 'EFECTIVO', total: 500.5, count: 1 },
          { method: 'TARJETA', total: 300, count: 1 }
        ]),
        byDay: [
          { date: '2026-10-05', total: 500.5 },
          { date: '2026-10-06', total: 300 }
        ]
      }
    });
  });

  test('un rango inválido responde { error: { code, message } } con 400', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await request(app).get('/api/reports/income?from=2026-10-31&to=2026-10-01').set(bearer(token));
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'REPORT_RANGE_INVALID', message: expect.any(String) } });
  });

  test('una fecha mal escrita responde VALIDATION_ERROR con details', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await request(app).get('/api/reports/income?from=hoy&to=2026-10-01').set(bearer(token));
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ code: 'VALIDATION_ERROR', message: expect.any(String), details: [{ field: 'from', message: expect.any(String) }] });
  });

  test('sin token responde 401', async () => {
    expect((await request(app).get('/api/reports/income?from=2026-10-01&to=2026-10-31')).status).toBe(401);
  });

  test.each(['RECEPTIONIST', 'MECHANIC'])('con el rol %s responde 403', async (rol) => {
    const { token } = await loginAs(rol);
    expect((await request(app).get('/api/reports/income?from=2026-10-01&to=2026-10-31').set(bearer(token))).status).toBe(403);
  });
});

describe.each(['services', 'productivity', 'parts-margin', 'inventory-turnover'])('contrato de GET /api/reports/%s', (reporte) => {
  const url = `/api/reports/${reporte}?from=2026-10-01&to=2026-10-31`;
  const meta = { page: 1, pageSize: 50, total: 0 };
  const vacio = {
    services: { data: [], meta },
    productivity: { data: [] },
    'parts-margin': { data: { items: [], totals: { salesTotal: 0, costTotal: 0, marginTotal: 0, withoutCostCount: 0 } }, meta },
    'inventory-turnover': { data: [], meta }
  };

  test('responde 200 con la forma del contrato', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await request(app).get(url).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual(vacio[reporte]);
  });

  test('un rango inválido responde 400 REPORT_RANGE_INVALID', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await request(app).get(`/api/reports/${reporte}?from=2026-10-31&to=2026-10-01`).set(bearer(token));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('REPORT_RANGE_INVALID');
  });

  test('sin token responde 401', async () => {
    expect((await request(app).get(url)).status).toBe(401);
  });

  test.each(['RECEPTIONIST', 'MECHANIC'])('con el rol %s responde 403', async (rol) => {
    const { token } = await loginAs(rol);
    expect((await request(app).get(url).set(bearer(token))).status).toBe(403);
  });
});
