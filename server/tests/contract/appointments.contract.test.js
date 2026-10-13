import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createClient, createVehicle, createAppointment } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

const appointmentShape = {
  id: expect.any(Number),
  clientId: expect.any(Number),
  clientName: expect.any(String),
  vehicleId: expect.any(Number),
  vehicleLabel: expect.any(String),
  scheduledAt: expect.any(String),
  reason: expect.any(String),
  notes: null,
  status: expect.stringMatching(/^(PENDIENTE|CONFIRMADA|EN_PROCESO|COMPLETADA|CANCELADA)$/),
  cancelReason: null,
  orderId: null,
  orderFolio: null,
  createdAt: expect.any(String),
  updatedAt: expect.any(String)
};

const enDias = (dias) => new Date(Date.now() + dias * 24 * 60 * 60 * 1000);

async function escenario() {
  const { token } = await loginAs('RECEPTIONIST');
  const client = await createClient({ name: 'Ana Pérez' });
  const vehicle = await createVehicle({ clientId: client.id, licensePlate: 'ABC1234' });
  return { token, client, vehicle };
}

describe('contrato de /api/appointments', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('GET /appointments devuelve { data: [Appointment], meta }', async () => {
    const { token, client, vehicle } = await escenario();
    await createAppointment({ clientId: client.id, vehicleId: vehicle.id });
    const res = await request(app).get('/api/appointments').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
    expect(res.body.data[0]).toEqual(appointmentShape);
    expect(res.body.data[0].vehicleLabel).toContain('ABC1234');
  });

  test('POST /appointments responde 201 con la cita en estado PENDIENTE', async () => {
    const { token, client, vehicle } = await escenario();
    const res = await request(app)
      .post('/api/appointments')
      .set(bearer(token))
      .send({ clientId: client.id, vehicleId: vehicle.id, scheduledAt: enDias(3).toISOString(), reason: 'Afinación', notes: 'Traer llave' });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ ...appointmentShape, status: 'PENDIENTE', reason: 'Afinación', notes: 'Traer llave' });
  });

  test('GET /appointments/{id} devuelve la cita', async () => {
    const { token, client, vehicle } = await escenario();
    const cita = await createAppointment({ clientId: client.id, vehicleId: vehicle.id });
    const res = await request(app).get(`/api/appointments/${cita.id}`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(appointmentShape);
  });

  test('PUT /appointments/{id} devuelve la cita modificada', async () => {
    const { token, client, vehicle } = await escenario();
    const cita = await createAppointment({ clientId: client.id, vehicleId: vehicle.id });
    const res = await request(app)
      .put(`/api/appointments/${cita.id}`)
      .set(bearer(token))
      .send({ scheduledAt: enDias(5).toISOString(), reason: 'Cambio de aceite', notes: null });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ ...appointmentShape, reason: 'Cambio de aceite' });
  });

  test('POST /appointments/{id}/confirm devuelve la cita CONFIRMADA', async () => {
    const { token, client, vehicle } = await escenario();
    const cita = await createAppointment({ clientId: client.id, vehicleId: vehicle.id });
    const res = await request(app).post(`/api/appointments/${cita.id}/confirm`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ ...appointmentShape, status: 'CONFIRMADA' });
  });

  test('POST /appointments/{id}/cancel devuelve la cita CANCELADA con el motivo', async () => {
    const { token, client, vehicle } = await escenario();
    const cita = await createAppointment({ clientId: client.id, vehicleId: vehicle.id });
    const res = await request(app)
      .post(`/api/appointments/${cita.id}/cancel`)
      .set(bearer(token))
      .send({ reason: 'El cliente no puede asistir' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ ...appointmentShape, status: 'CANCELADA', cancelReason: 'El cliente no puede asistir' });
  });

  test('los errores usan el formato { error: { code, message, details } }', async () => {
    const { token } = await escenario();
    const res = await request(app).post('/api/appointments').set(bearer(token)).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field).sort()).toEqual(['clientId', 'reason', 'scheduledAt', 'vehicleId']);
  });
});
