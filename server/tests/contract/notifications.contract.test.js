import request from 'supertest';
import app from '../../app.js';
import { createPart, resetTables, closePool } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

const formaDeAviso = {
  key: expect.stringMatching(/^(MAINT|APPT|STOCK|ORDER):[0-9]+$/),
  type: expect.stringMatching(/^(MAINTENANCE_SOON|MAINTENANCE_OVERDUE|APPOINTMENT_TODAY|STOCK_LOW|STOCK_OUT|ORDER_STALE)$/),
  severity: expect.any(Number),
  title: expect.any(String),
  detail: expect.any(String),
  read: expect.any(Boolean),
  target: {
    module: expect.stringMatching(/^(orders|appointments|maintenance|inventory)$/),
    id: expect.any(Number)
  }
};

const formaDeGrupo = {
  type: expect.any(String),
  label: expect.any(String),
  total: expect.any(Number),
  unread: expect.any(Number),
  items: expect.any(Array)
};

// La base se limpia antes de cada prueba y la conexión se cierra una sola vez, al terminar el archivo.
beforeEach(resetTables);
afterAll(closePool);

describe('contrato de GET /api/notifications', () => {
  test('responde { data: { unread, groups } } con la forma de cada grupo y de cada aviso', async () => {
    const { token } = await loginAs('ADMIN');
    await createPart({ code: 'LOW-1', name: 'Bujía baja', stock: 3, minStock: 3 });
    await createPart({ code: 'OUT-1', name: 'Filtro agotado', stock: 0, minStock: 3 });

    const res = await request(app).get('/api/notifications').set(bearer(token));

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data).sort()).toEqual(['groups', 'unread']);
    expect(res.body.data.unread).toBe(2);
    expect(res.body.data.groups.length).toBeGreaterThan(0);
    for (const grupo of res.body.data.groups) {
      expect(grupo).toEqual(formaDeGrupo);
      expect(grupo.items.length).toBeLessThanOrEqual(10);
      for (const aviso of grupo.items) {
        expect(aviso).toEqual(formaDeAviso);
        expect([1, 2]).toContain(aviso.severity);
      }
    }
  });

  test('sin avisos responde { unread: 0, groups: [] }', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await request(app).get('/api/notifications').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ unread: 0, groups: [] });
  });

  test('sin token responde 401 con el formato de error de siempre', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
    expect(res.body.error).toEqual({ code: 'UNAUTHENTICATED', message: expect.any(String) });
  });

  test('los tres roles pueden consultar el centro', async () => {
    for (const role of ['ADMIN', 'RECEPTIONIST', 'MECHANIC']) {
      const { token } = await loginAs(role, { username: `usuario-${role.toLowerCase()}` });
      const res = await request(app).get('/api/notifications').set(bearer(token));
      expect(res.status).toBe(200);
    }
  });
});

describe('contrato de GET /api/notifications/count', () => {
  test('responde { data: { unread } } solo con el total de no leídos', async () => {
    const { token } = await loginAs('ADMIN');
    await createPart({ code: 'LOW-1', name: 'Bujía baja', stock: 2, minStock: 3 });

    const res = await request(app).get('/api/notifications/count').set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { unread: 1 } });
  });

  test('sin avisos responde 0', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await request(app).get('/api/notifications/count').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.unread).toBe(0);
  });

  test('sin token responde 401', async () => {
    const res = await request(app).get('/api/notifications/count');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});
