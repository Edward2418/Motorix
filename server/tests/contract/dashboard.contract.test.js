import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

const dashboardShape = {
  period: { key: 'month', from: expect.any(String), to: expect.any(String) },
  indicators: {
    vehiclesInRepair: expect.any(Number),
    openOrders: expect.any(Number),
    collected: expect.any(Number),
    lowStockParts: expect.any(Number)
  },
  ordersByStatus: expect.any(Array),
  attention: {
    finishedOrders: { count: expect.any(Number), items: expect.any(Array) },
    upcomingAppointments: { count: expect.any(Number), items: expect.any(Array) },
    maintenance: { overdue: expect.any(Number), soon: expect.any(Number), items: expect.any(Array) },
    lowStockParts: { count: expect.any(Number), items: expect.any(Array) },
    pendingBalance: { total: expect.any(Number), count: expect.any(Number), items: expect.any(Array) }
  }
};

describe('contrato de GET /api/dashboard', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('responde { data } con la forma Dashboard y las siete entradas de ordersByStatus', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await request(app).get('/api/dashboard').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(dashboardShape);
    expect(res.body.data.ordersByStatus.map((e) => e.status)).toEqual([
      'RECIBIDO',
      'DIAGNOSTICO',
      'EN_REPARACION',
      'ESPERANDO_REFACCION',
      'TERMINADO',
      'ENTREGADO',
      'CANCELADA'
    ]);
    expect(res.body.data.ordersByStatus.every((e) => e.count === 0)).toBe(true);
  });

  test('acepta los tres periodos y los devuelve en period.key', async () => {
    const { token } = await loginAs('ADMIN');
    for (const period of ['today', 'week', 'month']) {
      const res = await request(app).get('/api/dashboard').query({ period }).set(bearer(token));
      expect({ period, status: res.status, key: res.body.data?.period.key }).toEqual({ period, status: 200, key: period });
    }
  });

  test('un periodo inválido responde 400', async () => {
    const { token } = await loginAs('ADMIN');
    for (const period of ['year', '', 'TODAY']) {
      const res = await request(app).get('/api/dashboard').query({ period }).set(bearer(token));
      expect({ period, status: res.status }).toEqual({ period, status: 400 });
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  test('sin sesión responde 401; recepción y mecánico reciben 403', async () => {
    expect((await request(app).get('/api/dashboard')).status).toBe(401);
    for (const rol of ['RECEPTIONIST', 'MECHANIC']) {
      const { token } = await loginAs(rol);
      const res = await request(app).get('/api/dashboard').set(bearer(token));
      expect({ rol, status: res.status, code: res.body.error?.code }).toEqual({ rol, status: 403, code: 'FORBIDDEN' });
    }
  });
});
