import request from 'supertest';
import app from '../../app.js';
import {
  resetTables,
  closePool,
  createClient,
  createVehicle,
  createMechanic,
  createOrder,
  createPart,
  createOrderPart,
  addServiceLine,
  markFinished
} from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

const entradaShape = {
  orderId: expect.any(Number),
  folio: expect.stringMatching(/^OS-\d{4}-\d{4}$/),
  status: expect.stringMatching(/^(TERMINADO|ENTREGADO)$/),
  serviceDate: expect.any(String),
  serviceMileage: expect.any(Number),
  mechanicName: expect.any(String),
  reportedProblem: expect.any(String),
  diagnosis: null,
  notes: null,
  recommendations: null,
  services: [{ description: 'Cambio de aceite', amount: 450 }],
  labor: [{ description: 'Mano de obra', amount: 200 }],
  parts: [
    {
      partId: expect.any(Number),
      code: 'FIL-01',
      name: 'Filtro de aceite',
      quantity: 2,
      unitPrice: 60
    }
  ],
  total: 770
};

describe('contrato de GET /api/vehicles/{id}/history', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('devuelve { data: [HistoryEntry], meta } con servicios, mano de obra, refacciones y total', async () => {
    const { token } = await loginAs('MECHANIC', { username: 'consulta' });
    const mecanico = await createMechanic({ username: 'dueno' });
    const client = await createClient();
    const vehicle = await createVehicle({ clientId: client.id });
    const orden = await createOrder({ clientId: client.id, vehicleId: vehicle.id, mechanicId: mecanico.id, status: 'ENTREGADO' });
    await markFinished({ orderId: orden.id, finishedAt: '2026-09-01 10:00:00', serviceMileage: 1200 });
    await addServiceLine(orden.id, 'Cambio de aceite', 450);
    await addServiceLine(orden.id, 'Mano de obra', 200, 'order_labor');
    const pieza = await createPart({ code: 'FIL-01', name: 'Filtro de aceite', stock: 10, salePrice: 60 });
    await createOrderPart({ orderId: orden.id, partId: pieza.id, quantity: 2 });

    const res = await request(app).get(`/api/vehicles/${vehicle.id}/history`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toEqual(entradaShape);
    expect(res.body.data[0].serviceMileage).toBe(1200);
  });

  test('401 sin sesión', async () => {
    const res = await request(app).get('/api/vehicles/1/history');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  test('404 si el vehículo no existe', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await request(app).get('/api/vehicles/9999/history').set(bearer(token));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('400 con un identificador o una paginación inválidos', async () => {
    const { token } = await loginAs('ADMIN');
    expect((await request(app).get('/api/vehicles/abc/history').set(bearer(token))).status).toBe(400);
    const client = await createClient();
    const vehicle = await createVehicle({ clientId: client.id });
    expect((await request(app).get(`/api/vehicles/${vehicle.id}/history?page=0`).set(bearer(token))).status).toBe(400);
  });
});
