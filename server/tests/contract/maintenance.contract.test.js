import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';

afterAll(closePool);

// Fecha local (AAAA-MM-DD) a `dias` días de hoy.
const en = (dias) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
};

const mantenimientoShape = {
  id: expect.any(Number),
  vehicleId: expect.any(Number),
  vehicleLabel: expect.stringContaining('ABC1234'),
  currentMileage: expect.any(Number),
  clientId: expect.any(Number),
  clientName: expect.any(String),
  clientPhone: expect.any(String),
  orderId: expect.any(Number),
  orderFolio: expect.stringMatching(/^OS-\d{4}-\d{4}$/),
  description: 'Cambio de aceite',
  dueDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
  dueMileage: 60000,
  notes: null,
  status: 'PROGRAMADO',
  visualStatus: expect.stringMatching(/^(NORMAL|PROXIMO|VENCIDO)$/),
  remainingDays: expect.any(Number),
  remainingKm: expect.any(Number),
  cancelReason: null,
  fulfilledOrderId: null,
  closedAt: null,
  createdAt: expect.any(String)
};

const programar = (token, orderId, body) => request(app).post(`/api/orders/${orderId}/maintenance`).set(bearer(token)).send(body);

describe('contrato de los mantenimientos programados', () => {
  beforeEach(resetTables);

  test('POST /orders/{id}/maintenance responde 201 con { data: Maintenance }', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const res = await programar(tokens.mecanico, orden.id, { description: 'Cambio de aceite', dueDate: en(90), dueMileage: 60000 });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(mantenimientoShape);
  });

  test('POST /orders/{id}/maintenance responde 400 con detalles por campo', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const res = await programar(tokens.mecanico, orden.id, { description: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['description', 'dueDate']));
  });

  test('POST responde 401 sin sesión, 403 sin permiso y 404 si la orden no existe', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const cuerpo = { description: 'Cambio de aceite', dueDate: en(30) };
    expect((await request(app).post(`/api/orders/${orden.id}/maintenance`).send(cuerpo)).status).toBe(401);
    expect((await programar(tokens.otro, orden.id, cuerpo)).status).toBe(403);
    expect((await programar(tokens.admin, 99999, cuerpo)).status).toBe(404);
  });

  test('POST responde 409 si la orden está cancelada', async () => {
    const { orden, tokens } = await escenarioOrden('CANCELADA');
    const res = await programar(tokens.admin, orden.id, { description: 'Cambio de aceite', dueDate: en(30) });
    expect(res.status).toBe(409);
  });

  test('POST /maintenance/{id}/fulfill y /cancel responden 200 con { data: Maintenance }', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const a = await programar(tokens.mecanico, orden.id, { description: 'Cambio de aceite', dueDate: en(90), dueMileage: 60000 });
    const b = await programar(tokens.mecanico, orden.id, { description: 'Rotación de llantas', dueDate: en(60) });

    const atendido = await request(app).post(`/api/maintenance/${a.body.data.id}/fulfill`).set(bearer(tokens.mecanico)).send({});
    expect(atendido.status).toBe(200);
    expect(atendido.body.data).toMatchObject({ status: 'ATENDIDO', visualStatus: null, closedAt: expect.any(String) });

    const cancelado = await request(app)
      .post(`/api/maintenance/${b.body.data.id}/cancel`)
      .set(bearer(tokens.mecanico))
      .send({ reason: 'El cliente lo pospuso' });
    expect(cancelado.status).toBe(200);
    expect(cancelado.body.data).toMatchObject({ status: 'CANCELADO', cancelReason: 'El cliente lo pospuso' });
  });

  test('POST /maintenance/{id}/cancel responde 400 sin motivo, 401, 403, 404 y 409', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const a = await programar(tokens.mecanico, orden.id, { description: 'Cambio de aceite', dueDate: en(90) });
    const id = a.body.data.id;

    expect((await request(app).post(`/api/maintenance/${id}/cancel`).send({ reason: 'x' })).status).toBe(401);
    expect((await request(app).post(`/api/maintenance/${id}/cancel`).set(bearer(tokens.mecanico)).send({})).status).toBe(400);
    expect((await request(app).post(`/api/maintenance/${id}/cancel`).set(bearer(tokens.otro)).send({ reason: 'x' })).status).toBe(403);
    expect((await request(app).post('/api/maintenance/99999/cancel').set(bearer(tokens.admin)).send({ reason: 'x' })).status).toBe(404);
    await request(app).post(`/api/maintenance/${id}/cancel`).set(bearer(tokens.admin)).send({ reason: 'x' });
    expect((await request(app).post(`/api/maintenance/${id}/cancel`).set(bearer(tokens.admin)).send({ reason: 'x' })).status).toBe(409);
  });

  test('la base conserva los mantenimientos cancelados y atendidos', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const a = await programar(tokens.mecanico, orden.id, { description: 'Cambio de aceite', dueDate: en(90) });
    await request(app).post(`/api/maintenance/${a.body.data.id}/cancel`).set(bearer(tokens.admin)).send({ reason: 'x' });
    expect((await pool.query('SELECT COUNT(*) AS total FROM maintenance'))[0][0].total).toBe(1);
  });
});
