import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createClient, createVehicle, createMechanic, createOrder, createMaintenance } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

afterAll(closePool);

const mantenimientoShape = {
  id: expect.any(Number),
  vehicleId: expect.any(Number),
  vehicleLabel: expect.stringContaining('LST1234'),
  currentMileage: 50000,
  clientId: expect.any(Number),
  clientName: 'Ana Pérez',
  clientPhone: '5551234567',
  orderId: expect.any(Number),
  orderFolio: expect.stringMatching(/^OS-\d{4}-\d{4}$/),
  description: 'Cambio de aceite',
  dueDate: null,
  dueMileage: 50500,
  notes: null,
  status: 'PROGRAMADO',
  visualStatus: 'PROXIMO',
  remainingDays: null,
  remainingKm: 500,
  cancelReason: null,
  fulfilledOrderId: null,
  closedAt: null,
  createdAt: expect.any(String)
};

describe('contrato de GET /api/maintenance', () => {
  beforeEach(resetTables);

  test('devuelve { data: [Maintenance], meta } con el estado visual y los restantes', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const mecanico = await createMechanic();
    const cliente = await createClient({ name: 'Ana Pérez', phone: '5551234567' });
    const vehiculo = await createVehicle({ clientId: cliente.id, licensePlate: 'LST1234' });
    await pool.query('UPDATE vehicles SET current_mileage = 50000 WHERE id = ?', [vehiculo.id]);
    const orden = await createOrder({ clientId: cliente.id, vehicleId: vehiculo.id, mechanicId: mecanico.id, status: 'ENTREGADO' });
    await createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, dueMileage: 50500 });

    const res = await request(app).get('/api/maintenance').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toEqual(mantenimientoShape);
  });

  test('responde 401 sin sesión', async () => {
    const res = await request(app).get('/api/maintenance');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  test('responde 400 con un estado visual, un ciclo de vida o una paginación inválidos', async () => {
    const { token } = await loginAs('ADMIN');
    for (const consulta of ['visualStatus=LEJANO', 'status=ABIERTO', 'clientId=0', 'page=0', 'pageSize=500']) {
      const res = await request(app).get(`/api/maintenance?${consulta}`).set(bearer(token));
      expect({ consulta, status: res.status }).toEqual({ consulta, status: 400 });
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });
});
