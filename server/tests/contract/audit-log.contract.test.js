import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

// La base se limpia antes de cada prueba y la conexión se cierra una sola vez, al terminar el archivo.
beforeEach(resetTables);
afterAll(closePool);

const consultar = (token) => request(app).get('/api/audit-log').set(bearer(token));

describe('contrato de GET /api/audit-log', () => {
  test('responde 200 con { data: [...], meta: { page, pageSize, total } } y los campos de cada registro', async () => {
    const { token, user } = await loginAs('ADMIN');
    await pool.query(
      "INSERT INTO audit_log (user_id, actor, action, entity, entity_id, detail) VALUES (?, 'admin', 'PART_PRICE_CHANGED', 'PART', 7, 'precio de venta: 180.00 → 250.00')",
      [user.id]
    );

    const res = await consultar(token);

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 50, total: 1 });
    expect(res.body.data[0]).toEqual({
      id: expect.any(Number),
      userId: user.id,
      actor: 'admin',
      action: 'PART_PRICE_CHANGED',
      entity: 'PART',
      entityId: 7,
      detail: 'precio de venta: 180.00 → 250.00',
      createdAt: expect.any(String)
    });
  });

  test('sin registros responde { data: [], meta: { total: 0 } }', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await consultar(token);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  test('sin token responde 401', async () => {
    expect((await request(app).get('/api/audit-log')).status).toBe(401);
  });

  test.each(['RECEPTIONIST', 'MECHANIC'])('con el rol %s responde 403', async (rol) => {
    const { token } = await loginAs(rol);
    expect((await consultar(token)).status).toBe(403);
  });
});
