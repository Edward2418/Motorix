import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createClient } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

const clientShape = {
  id: expect.any(Number),
  name: expect.any(String),
  phone: expect.any(String),
  email: null,
  active: expect.any(Boolean),
  vehicleCount: expect.any(Number),
  createdAt: expect.any(String),
  updatedAt: expect.any(String)
};

describe('contrato de edición de /api/clients', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('PUT /clients/{id} devuelve el cliente actualizado', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const client = await createClient({ name: 'Nombre viejo' });
    const res = await request(app)
      .put(`/api/clients/${client.id}`)
      .set(bearer(token))
      .send({ name: 'Nombre nuevo', phone: '5598765432' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ ...clientShape, name: 'Nombre nuevo', phone: '5598765432' });
  });

  test('PATCH /clients/{id}/status devuelve el cliente con su nuevo estado', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const client = await createClient();
    const res = await request(app).patch(`/api/clients/${client.id}/status`).set(bearer(token)).send({ active: false });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ ...clientShape, active: false });
  });

  test('una baja rechazada usa el formato de error con código CONFLICT', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const { createVehicle } = await import('../helpers/db.js');
    const client = await createClient();
    await createVehicle({ clientId: client.id });
    const res = await request(app).patch(`/api/clients/${client.id}/status`).set(bearer(token)).send({ active: false });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: 'CONFLICT', message: expect.any(String) } });
  });
});
