import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createClient, createVehicle } from '../helpers/db.js';
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

describe('contrato de /api/clients', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('GET /clients devuelve { data: [...], meta } con la forma de Client', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    await createClient({ name: 'Ana Pérez' });
    const res = await request(app).get('/api/clients').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
    expect(res.body.data[0]).toEqual(clientShape);
  });

  test('POST /clients responde 201 con el cliente creado', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const res = await request(app)
      .post('/api/clients')
      .set(bearer(token))
      .send({ name: 'Luis Gómez', phone: '55 1234 5678' });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ ...clientShape, name: 'Luis Gómez', phone: '55 1234 5678', vehicleCount: 0 });
  });

  test('GET /clients/{id} devuelve el cliente con su lista de vehículos', async () => {
    const { token } = await loginAs('MECHANIC');
    const client = await createClient({ name: 'Marta Ruiz' });
    await createVehicle({ clientId: client.id, licensePlate: 'XYZ789' });
    const res = await request(app).get(`/api/clients/${client.id}`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      ...clientShape,
      name: 'Marta Ruiz',
      vehicleCount: 1,
      vehicles: [
        {
          id: expect.any(Number),
          clientId: client.id,
          clientName: 'Marta Ruiz',
          brand: 'Nissan',
          model: 'Versa',
          year: 2020,
          licensePlate: 'XYZ789',
          vin: null,
          currentMileage: 0,
          active: true,
          createdAt: expect.any(String),
          updatedAt: expect.any(String)
        }
      ]
    });
  });
});
