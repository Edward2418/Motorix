import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createClient, createVehicle, createMechanic, createOrder } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

const summaryShape = {
  id: expect.any(Number),
  folio: expect.stringMatching(/^OS-\d{4}-\d{4}$/),
  status: expect.any(String),
  clientId: expect.any(Number),
  clientName: expect.any(String),
  vehicleId: expect.any(Number),
  vehicleLabel: expect.any(String),
  mechanicId: expect.any(Number),
  mechanicName: expect.any(String),
  entryMileage: expect.any(Number),
  total: expect.any(Number),
  // Solo para administración y recepción (la prueba usa recepción).
  paymentStatus: 'SIN_PAGO',
  createdAt: expect.any(String),
  updatedAt: expect.any(String)
};

describe('contrato de GET /api/orders', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('devuelve { data: [OrderSummary], meta } y no incluye el contenido técnico de la orden', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const mecanico = await createMechanic();
    const client = await createClient({ name: 'Ana Pérez' });
    const vehicle = await createVehicle({ clientId: client.id, licensePlate: 'ABC1234' });
    await createOrder({ clientId: client.id, vehicleId: vehicle.id, mechanicId: mecanico.id });

    const res = await request(app).get('/api/orders').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toEqual(summaryShape);
    expect(res.body.data[0].vehicleLabel).toContain('ABC1234');
  });

  test('GET /orders/{id} devuelve el detalle completo (OrderDetail)', async () => {
    const { token } = await loginAs('ADMIN');
    const mecanico = await createMechanic();
    const client = await createClient();
    const vehicle = await createVehicle({ clientId: client.id });
    const orden = await createOrder({ clientId: client.id, vehicleId: vehicle.id, mechanicId: mecanico.id });

    const res = await request(app).get(`/api/orders/${orden.id}`).set(bearer(token));
    expect(res.status).toBe(200);
    // El detalle lleva el resumen completo en `payment`, no `paymentStatus`.
    const { paymentStatus, ...detalleBase } = summaryShape;
    expect(res.body.data).toMatchObject({
      ...detalleBase,
      payment: expect.objectContaining({ status: 'SIN_PAGO' }),
      reportedProblem: expect.any(String),
      services: [],
      labor: [],
      history: expect.any(Array),
      allowedTransitions: expect.any(Array)
    });
  });
});
