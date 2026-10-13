import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createClient, createVehicle } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

const orderDetailShape = {
  id: expect.any(Number),
  folio: expect.stringMatching(/^OS-\d{4}-\d{4}$/),
  status: 'RECIBIDO',
  clientId: expect.any(Number),
  clientName: expect.any(String),
  vehicleId: expect.any(Number),
  vehicleLabel: expect.any(String),
  mechanicId: expect.any(Number),
  mechanicName: expect.any(String),
  entryMileage: expect.any(Number),
  previousMileage: expect.any(Number),
  mileageCorrectionReason: null,
  appointmentId: null,
  reportedProblem: expect.any(String),
  diagnosis: null,
  notes: null,
  recommendations: null,
  cancelReason: null,
  deliveredAt: null,
  services: [],
  labor: [],
  servicesTotal: 0,
  laborTotal: 0,
  total: 0,
  history: [
    {
      fromStatus: null,
      toStatus: 'RECIBIDO',
      changedBy: expect.any(String),
      reason: null,
      changedAt: expect.any(String)
    }
  ],
  allowedTransitions: expect.any(Array),
  createdAt: expect.any(String),
  updatedAt: expect.any(String)
};

describe('contrato de /api/orders (creación y detalle)', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  async function escenario() {
    const recepcion = await loginAs('RECEPTIONIST');
    const mecanico = await loginAs('MECHANIC');
    const client = await createClient({ name: 'Ana Pérez' });
    const vehicle = await createVehicle({ clientId: client.id, licensePlate: 'ABC1234' });
    return { recepcion, mecanico, client, vehicle };
  }

  test('POST /orders responde 201 con el detalle completo de la orden', async () => {
    const { recepcion, mecanico, client, vehicle } = await escenario();
    const res = await request(app)
      .post('/api/orders')
      .set(bearer(recepcion.token))
      .send({
        clientId: client.id,
        vehicleId: vehicle.id,
        mechanicId: mecanico.user.id,
        entryMileage: 12000,
        reportedProblem: 'Ruido al frenar'
      });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(orderDetailShape);
    expect(res.body.data.vehicleLabel).toContain('ABC1234');
    expect(res.body.data.clientName).toBe('Ana Pérez');
  });

  test('GET /orders/{id} devuelve la misma forma de OrderDetail', async () => {
    const { recepcion, mecanico, client, vehicle } = await escenario();
    const creada = await request(app)
      .post('/api/orders')
      .set(bearer(recepcion.token))
      .send({
        clientId: client.id,
        vehicleId: vehicle.id,
        mechanicId: mecanico.user.id,
        entryMileage: 12000,
        reportedProblem: 'Ruido al frenar'
      });
    const res = await request(app).get(`/api/orders/${creada.body.data.id}`).set(bearer(recepcion.token));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(orderDetailShape);
  });

  test('PUT /orders/{id}/mechanic devuelve el detalle con el nuevo mecánico', async () => {
    const { recepcion, mecanico, client, vehicle } = await escenario();
    const otro = await loginAs('MECHANIC', { username: 'otro.mecanico' });
    const creada = await request(app)
      .post('/api/orders')
      .set(bearer(recepcion.token))
      .send({
        clientId: client.id,
        vehicleId: vehicle.id,
        mechanicId: mecanico.user.id,
        entryMileage: 12000,
        reportedProblem: 'Ruido al frenar'
      });
    const res = await request(app)
      .put(`/api/orders/${creada.body.data.id}/mechanic`)
      .set(bearer(recepcion.token))
      .send({ mechanicId: otro.user.id });
    expect(res.status).toBe(200);
    expect(res.body.data.mechanicId).toBe(otro.user.id);
  });

  test('GET /mechanics devuelve { data: [{ id, name, openOrders }] }', async () => {
    const { recepcion } = await escenario();
    const res = await request(app).get('/api/mechanics').set(bearer(recepcion.token));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ id: expect.any(Number), name: expect.any(String), openOrders: 0 }]);
  });

  test('los errores de negocio usan el formato { error: { code, message } }', async () => {
    const { recepcion, client } = await escenario();
    const res = await request(app)
      .post('/api/orders')
      .set(bearer(recepcion.token))
      .send({ clientId: client.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });
});
