import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createClient, createVehicle, createMechanic } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

const enDias = (dias) => new Date(Date.now() + dias * 24 * 60 * 60 * 1000);

async function base() {
  const recepcion = await loginAs('RECEPTIONIST');
  const mecanico = await createMechanic();
  const client = await createClient({ name: 'Ana Pérez' });
  const vehicle = await createVehicle({ clientId: client.id, licensePlate: 'ABC1234' });
  const cita = await request(app)
    .post('/api/appointments')
    .set(bearer(recepcion.token))
    .send({ clientId: client.id, vehicleId: vehicle.id, scheduledAt: enDias(2).toISOString(), reason: 'Revisión general' });
  const crearOrden = (extra = {}) =>
    request(app)
      .post('/api/orders')
      .set(bearer(recepcion.token))
      .send({
        clientId: client.id,
        vehicleId: vehicle.id,
        mechanicId: mecanico.id,
        entryMileage: 1000,
        reportedProblem: 'Ruido',
        appointmentId: cita.body.data.id,
        ...extra
      });
  const cambiar = (orderId, body) =>
    request(app).post(`/api/orders/${orderId}/status`).set(bearer(recepcion.token)).send(body);
  const estadoCita = async () =>
    (await request(app).get(`/api/appointments/${cita.body.data.id}`).set(bearer(recepcion.token))).body.data;
  return { recepcion, mecanico, client, vehicle, cita: cita.body.data, crearOrden, cambiar, estadoCita };
}

describe('citas y órdenes: efectos entre sí', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('crear una orden desde la cita la deja EN_PROCESO con la orden vinculada', async () => {
    const { crearOrden, estadoCita, cita } = await base();
    const orden = await crearOrden();
    expect(orden.status).toBe(201);
    expect(orden.body.data.appointmentId).toBe(cita.id);

    const despues = await estadoCita();
    expect(despues).toMatchObject({ status: 'EN_PROCESO', orderId: orden.body.data.id, orderFolio: orden.body.data.folio });
  });

  test('también funciona con una cita CONFIRMADA', async () => {
    const { recepcion, crearOrden, estadoCita, cita } = await base();
    await request(app).post(`/api/appointments/${cita.id}/confirm`).set(bearer(recepcion.token));
    expect((await crearOrden()).status).toBe(201);
    expect((await estadoCita()).status).toBe('EN_PROCESO');
  });

  test('rechaza una cita CANCELADA, COMPLETADA o ya vinculada a otra orden', async () => {
    for (const estado of ['CANCELADA', 'COMPLETADA']) {
      await resetTables();
      const { crearOrden, cita } = await base();
      await pool.query('UPDATE appointments SET status = ? WHERE id = ?', [estado, cita.id]);
      expect({ estado, status: (await crearOrden()).status }).toEqual({ estado, status: 409 });
    }

    await resetTables();
    const { crearOrden, cambiar } = await base();
    const primera = await crearOrden();
    await cambiar(primera.body.data.id, { status: 'CANCELADA', reason: 'Prueba' });
    // La cita quedó CANCELADA con la orden: no se puede volver a usar.
    expect((await crearOrden()).status).toBe(409);
  });

  test('rechaza una cita de otro cliente o vehículo, o inexistente', async () => {
    const { crearOrden, recepcion } = await base();
    const otro = await createClient({ name: 'Otro', phone: '5598765432' });
    const otroVehiculo = await createVehicle({ clientId: otro.id, licensePlate: 'OTR0001' });
    expect((await crearOrden({ clientId: otro.id, vehicleId: otroVehiculo.id })).status).toBe(400);
    expect((await crearOrden({ appointmentId: 9999 })).status).toBe(400);
    expect(recepcion).toBeDefined();
  });

  test('no se puede cancelar directamente una cita que ya tiene una orden', async () => {
    const { recepcion, crearOrden, cita } = await base();
    await crearOrden();
    const res = await request(app)
      .post(`/api/appointments/${cita.id}/cancel`)
      .set(bearer(recepcion.token))
      .send({ reason: 'Intento directo' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/orden/i);
  });

  test('entregar la orden deja la cita COMPLETADA', async () => {
    const { crearOrden, cambiar, estadoCita } = await base();
    const orden = await crearOrden();
    for (const estado of ['DIAGNOSTICO', 'EN_REPARACION', 'TERMINADO', 'ENTREGADO']) {
      await cambiar(orden.body.data.id, { status: estado, serviceMileage: 999999 });
    }
    expect((await estadoCita()).status).toBe('COMPLETADA');
  });

  test('cancelar la orden deja la cita CANCELADA con el motivo', async () => {
    const { crearOrden, cambiar, estadoCita } = await base();
    const orden = await crearOrden();
    await cambiar(orden.body.data.id, { status: 'CANCELADA', reason: 'El cliente se arrepintió' });
    expect(await estadoCita()).toMatchObject({ status: 'CANCELADA', cancelReason: 'El cliente se arrepintió' });
  });

  test('crear órdenes sin cita sigue funcionando', async () => {
    const { crearOrden } = await base();
    const res = await crearOrden({ appointmentId: undefined });
    expect(res.status).toBe(201);
    expect(res.body.data.appointmentId).toBeNull();
  });

  test('la orden creada desde una cita no deja la cita EN_PROCESO si falla la creación', async () => {
    const { recepcion, crearOrden, estadoCita } = await base();
    // Un kilometraje inválido para el vehículo hace fallar la creación después de validar la cita.
    await pool.query('UPDATE vehicles SET current_mileage = 5000');
    const res = await crearOrden({ entryMileage: 100 });
    expect(res.status).toBe(400);
    expect((await estadoCita()).status).toBe('PENDIENTE');
    expect(recepcion).toBeDefined();
  });
});
