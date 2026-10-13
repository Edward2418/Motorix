import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createClient, createVehicle } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

const vehicleShape = {
  id: expect.any(Number),
  clientId: expect.any(Number),
  clientName: expect.any(String),
  brand: expect.any(String),
  model: expect.any(String),
  year: expect.any(Number),
  licensePlate: expect.any(String),
  vin: null,
  currentMileage: expect.any(Number),
  active: expect.any(Boolean),
  createdAt: expect.any(String),
  updatedAt: expect.any(String)
};

describe('contrato de /api/vehicles', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('GET /vehicles devuelve { data: [...], meta } con la forma de Vehicle', async () => {
    const { token } = await loginAs('MECHANIC');
    const client = await createClient();
    await createVehicle({ clientId: client.id });
    const res = await request(app).get('/api/vehicles').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
    expect(res.body.data[0]).toEqual(vehicleShape);
  });

  test('POST /vehicles responde 201 con el vehículo creado y su propietario', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const client = await createClient({ name: 'Ana Pérez' });
    const res = await request(app)
      .post('/api/vehicles')
      .set(bearer(token))
      .send({ clientId: client.id, brand: 'Nissan', model: 'Versa', year: 2021, licensePlate: 'abc-123' });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({
      ...vehicleShape,
      clientId: client.id,
      clientName: 'Ana Pérez',
      year: 2021,
      licensePlate: 'ABC123',
      currentMileage: 0,
      active: true
    });
  });

  test('GET /vehicles/{id} devuelve el vehículo', async () => {
    const { token } = await loginAs('MECHANIC');
    const client = await createClient();
    const vehicle = await createVehicle({ clientId: client.id });
    const res = await request(app).get(`/api/vehicles/${vehicle.id}`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(vehicleShape);
  });

  test('PATCH /vehicles/{id}/status devuelve el vehículo actualizado', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const client = await createClient();
    const vehicle = await createVehicle({ clientId: client.id });
    const res = await request(app)
      .patch(`/api/vehicles/${vehicle.id}/status`)
      .set(bearer(token))
      .send({ active: false });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ ...vehicleShape, active: false });
  });
});
