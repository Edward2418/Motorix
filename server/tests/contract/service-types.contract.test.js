import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createServiceType } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

beforeEach(resetTables);
afterAll(closePool);

// Un intervalo es un entero o `null` cuando el tipo no lo tiene.
const intervalo = { asymmetricMatch: (valor) => valor === null || Number.isInteger(valor) };
const forma = { id: expect.any(Number), name: expect.any(String), intervalDays: intervalo, intervalKm: intervalo, active: expect.any(Boolean) };

describe('contrato de /api/service-types', () => {
  test('GET /: { data: [ServiceType] }', async () => {
    const { token } = await loginAs('MECHANIC');
    await createServiceType({ name: 'Aceite', intervalDays: null, intervalKm: 5000 });

    const res = await request(app).get('/api/service-types').set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toEqual({ id: expect.any(Number), name: 'Aceite', intervalDays: null, intervalKm: 5000, active: true });
  });

  test('POST /: 201 con { data: ServiceType }; 400 validación; 409 SERVICE_TYPE_DUPLICATE', async () => {
    const { token } = await loginAs('ADMIN');

    const ok = await request(app).post('/api/service-types').set(bearer(token)).send({ name: 'Frenos', intervalDays: 365 });
    expect(ok.status).toBe(201);
    expect(ok.body.data).toEqual({ ...forma, name: 'Frenos', intervalDays: 365, intervalKm: null, active: true });

    const invalido = await request(app).post('/api/service-types').set(bearer(token)).send({ name: 'X' });
    expect(invalido.status).toBe(400);
    expect(invalido.body.error).toEqual({ code: 'VALIDATION_ERROR', message: expect.any(String), details: expect.any(Array) });

    const repetido = await request(app).post('/api/service-types').set(bearer(token)).send({ name: 'frenos', intervalDays: 30 });
    expect(repetido.status).toBe(409);
    expect(repetido.body.error).toEqual({ code: 'SERVICE_TYPE_DUPLICATE', message: expect.any(String) });
  });

  test('PUT /:id: 200 con { data: ServiceType }; 404 con un id inexistente', async () => {
    const { token } = await loginAs('ADMIN');
    const tipo = await createServiceType();

    const ok = await request(app).put(`/api/service-types/${tipo.id}`).set(bearer(token)).send({ name: 'Nuevo nombre', intervalDays: 10 });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toEqual({ ...forma, name: 'Nuevo nombre' });

    const inexistente = await request(app).put('/api/service-types/9999').set(bearer(token)).send({ name: 'X', intervalDays: 10 });
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.error.code).toBe('NOT_FOUND');
  });

  test('PATCH /:id/status: 200 con { data: ServiceType }; 400 sin active; 404 inexistente', async () => {
    const { token } = await loginAs('ADMIN');
    const tipo = await createServiceType();

    const ok = await request(app).patch(`/api/service-types/${tipo.id}/status`).set(bearer(token)).send({ active: false });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toEqual({ ...forma, active: false });
    expect((await request(app).patch(`/api/service-types/${tipo.id}/status`).set(bearer(token)).send({})).status).toBe(400);
    expect((await request(app).patch('/api/service-types/9999/status').set(bearer(token)).send({ active: true })).status).toBe(404);
  });

  test('sin token las cuatro rutas responden 401', async () => {
    for (const [metodo, ruta] of [['get', '/api/service-types'], ['post', '/api/service-types'], ['put', '/api/service-types/1'], ['patch', '/api/service-types/1/status']]) {
      expect((await request(app)[metodo](ruta).send({})).status).toBe(401);
    }
  });

  test('la escritura con otros roles responde 403 FORBIDDEN', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const tipo = await createServiceType();
    for (const res of [
      await request(app).post('/api/service-types').set(bearer(token)).send({ name: 'X', intervalDays: 1 }),
      await request(app).put(`/api/service-types/${tipo.id}`).set(bearer(token)).send({ name: 'X', intervalDays: 1 }),
      await request(app).patch(`/api/service-types/${tipo.id}/status`).set(bearer(token)).send({ active: false })
    ]) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
  });
});
