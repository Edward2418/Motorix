import request from 'supertest';
import app from '../../app.js';
import {
  pool,
  resetTables,
  closePool,
  createClient,
  createVehicle,
  createMechanic,
  createOrder,
  createAppointment
} from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

const post = (token, body) => request(app).post('/api/orders').set(bearer(token)).send(body);

async function base({ rol = 'RECEPTIONIST', kilometraje = 0 } = {}) {
  const actor = await loginAs(rol);
  const mecanico = await createMechanic();
  const client = await createClient({ name: 'Ana Pérez' });
  const vehicle = await createVehicle({ clientId: client.id, licensePlate: 'ABC1234' });
  if (kilometraje > 0) {
    await pool.query('UPDATE vehicles SET current_mileage = ? WHERE id = ?', [kilometraje, vehicle.id]);
  }
  const datos = (extra = {}) => ({
    clientId: client.id,
    vehicleId: vehicle.id,
    mechanicId: mecanico.id,
    entryMileage: kilometraje + 500,
    reportedProblem: 'Ruido al frenar',
    ...extra
  });
  return { actor, mecanico, client, vehicle, datos };
}

const kilometrajeDe = async (vehicleId) =>
  (await pool.query('SELECT current_mileage FROM vehicles WHERE id = ?', [vehicleId]))[0][0].current_mileage;

describe('órdenes: creación', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('crea la orden en RECIBIDO con folio, historial inicial y kilometraje del vehículo actualizado', async () => {
    const { actor, mecanico, vehicle, datos } = await base({ kilometraje: 45000 });
    const res = await post(actor.token, datos({ entryMileage: 45800 }));

    expect(res.status).toBe(201);
    const orden = res.body.data;
    expect(orden.status).toBe('RECIBIDO');
    expect(orden.folio).toMatch(new RegExp(`^OS-${new Date().getFullYear()}-0001$`));
    expect(orden.entryMileage).toBe(45800);
    expect(orden.previousMileage).toBe(45000);
    expect(orden.mechanicId).toBe(mecanico.id);
    expect(orden.history).toHaveLength(1);
    expect(orden.history[0]).toMatchObject({ fromStatus: null, toStatus: 'RECIBIDO' });
    expect(await kilometrajeDe(vehicle.id)).toBe(45800);
  });

  test('GET /orders/{id} devuelve la orden recién creada con su historial', async () => {
    const { actor, datos } = await base();
    const creada = await post(actor.token, datos());
    const res = await request(app).get(`/api/orders/${creada.body.data.id}`).set(bearer(actor.token));
    expect(res.status).toBe(200);
    expect(res.body.data.folio).toBe(creada.body.data.folio);
    expect(res.body.data.history).toHaveLength(1);
  });

  test('el administrador también puede crear órdenes', async () => {
    const { actor, datos } = await base({ rol: 'ADMIN' });
    expect((await post(actor.token, datos())).status).toBe(201);
  });

  test('rechaza un cliente o un vehículo inexistente', async () => {
    const { actor, datos } = await base();
    expect((await post(actor.token, datos({ clientId: 9999 }))).status).toBe(400);
    expect((await post(actor.token, datos({ vehicleId: 9999 }))).status).toBe(400);
  });

  test('rechaza un cliente o un vehículo desactivado', async () => {
    const { actor, client, vehicle, datos } = await base();
    await pool.query('UPDATE vehicles SET active = 0 WHERE id = ?', [vehicle.id]);
    expect((await post(actor.token, datos())).status).toBe(409);

    await pool.query('UPDATE vehicles SET active = 1 WHERE id = ?', [vehicle.id]);
    await pool.query('UPDATE clients SET active = 0 WHERE id = ?', [client.id]);
    expect((await post(actor.token, datos())).status).toBe(409);
  });

  test('rechaza un vehículo que no pertenece al cliente indicado', async () => {
    const { actor, datos } = await base();
    const otro = await createClient({ name: 'Otro Cliente', phone: '5598765432' });
    const res = await post(actor.token, datos({ clientId: otro.id }));
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain('vehicleId');
  });

  test('rechaza una segunda orden abierta para el mismo vehículo e indica el folio', async () => {
    const { actor, datos } = await base();
    const primera = await post(actor.token, datos());
    const segunda = await post(actor.token, datos());
    expect(segunda.status).toBe(409);
    expect(segunda.body.error.message).toContain(primera.body.data.folio);
  });

  test('permite una nueva orden cuando la anterior está ENTREGADO o CANCELADA', async () => {
    const { actor, datos } = await base();
    for (const estado of ['ENTREGADO', 'CANCELADA']) {
      const creada = await post(actor.token, datos());
      expect(creada.status).toBe(201);
      await pool.query('UPDATE service_orders SET status = ? WHERE id = ?', [estado, creada.body.data.id]);
    }
    expect((await post(actor.token, datos())).status).toBe(201);
  });

  test('la base de datos impide dos órdenes abiertas aunque falle la validación de la aplicación', async () => {
    const { client, vehicle, mecanico } = await base();
    await createOrder({ clientId: client.id, vehicleId: vehicle.id, mechanicId: mecanico.id });
    await expect(
      createOrder({ clientId: client.id, vehicleId: vehicle.id, mechanicId: mecanico.id })
    ).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
  });

  test('rechaza un mecánico inexistente, desactivado o sin rol de mecánico', async () => {
    const { actor, datos } = await base();
    expect((await post(actor.token, datos({ mechanicId: 9999 }))).status).toBe(400);

    const baja = await createMechanic({ username: 'baja', active: false });
    expect((await post(actor.token, datos({ mechanicId: baja.id }))).status).toBe(400);

    const recepcion = await loginAs('RECEPTIONIST', { username: 'otra.recepcion' });
    expect((await post(actor.token, datos({ mechanicId: recepcion.user.id }))).status).toBe(400);
  });

  test('valida el kilometraje de entrada: obligatorio, entero y no negativo', async () => {
    const { actor, datos } = await base();
    for (const invalido of [undefined, null, -5, 10.5, '1000', 4294967296]) {
      const res = await post(actor.token, datos({ entryMileage: invalido }));
      expect({ valor: invalido, status: res.status }).toEqual({ valor: invalido, status: 400 });
      expect(res.body.error.details.map((d) => d.field)).toContain('entryMileage');
    }
  });

  test('rechaza un kilometraje menor al registrado e indica el kilometraje previo', async () => {
    const { actor, vehicle, datos } = await base({ kilometraje: 45000 });
    const res = await post(actor.token, datos({ entryMileage: 40000 }));
    expect(res.status).toBe(400);
    expect(res.body.error.message + JSON.stringify(res.body.error.details)).toMatch(/45,?000/);
    expect(await kilometrajeDe(vehicle.id)).toBe(45000);
  });

  test('un vehículo sin kilometraje previo (0) acepta cualquier valor mayor o igual a 0', async () => {
    const { actor, datos } = await base();
    expect((await post(actor.token, datos({ entryMileage: 0 }))).status).toBe(201);
  });

  test('un kilometraje igual al registrado es válido', async () => {
    const { actor, datos } = await base({ kilometraje: 45000 });
    expect((await post(actor.token, datos({ entryMileage: 45000 }))).status).toBe(201);
  });

  test('un administrador puede corregir el kilometraje a la baja con un motivo', async () => {
    const { actor, vehicle, datos } = await base({ rol: 'ADMIN', kilometraje: 45000 });
    const res = await post(
      actor.token,
      datos({ entryMileage: 40000, correctMileage: true, mileageCorrectionReason: 'Error de captura previo' })
    );
    expect(res.status).toBe(201);
    expect(res.body.data.entryMileage).toBe(40000);
    expect(res.body.data.previousMileage).toBe(45000);
    expect(res.body.data.mileageCorrectionReason).toBe('Error de captura previo');
    expect(await kilometrajeDe(vehicle.id)).toBe(40000);
  });

  test('la corrección sin motivo se rechaza', async () => {
    const { actor, datos } = await base({ rol: 'ADMIN', kilometraje: 45000 });
    for (const motivo of [undefined, '', '   ']) {
      const res = await post(actor.token, datos({ entryMileage: 40000, correctMileage: true, mileageCorrectionReason: motivo }));
      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d) => d.field)).toContain('mileageCorrectionReason');
    }
  });

  test('la bandera de corrección con un kilometraje que no es menor se rechaza', async () => {
    const { actor, datos } = await base({ rol: 'ADMIN', kilometraje: 45000 });
    const res = await post(
      actor.token,
      datos({ entryMileage: 46000, correctMileage: true, mileageCorrectionReason: 'No hacía falta' })
    );
    expect(res.status).toBe(400);
  });

  test('recepción no puede registrar una corrección a la baja', async () => {
    const { actor, vehicle, datos } = await base({ rol: 'RECEPTIONIST', kilometraje: 45000 });
    const res = await post(
      actor.token,
      datos({ entryMileage: 40000, correctMileage: true, mileageCorrectionReason: 'Quiero bajarlo' })
    );
    expect(res.status).toBe(403);
    expect(await kilometrajeDe(vehicle.id)).toBe(45000);
  });

  test('el problema reportado es obligatorio y admite hasta 2000 caracteres', async () => {
    const { actor, datos } = await base();
    expect((await post(actor.token, datos({ reportedProblem: '' }))).status).toBe(400);
    expect((await post(actor.token, datos({ reportedProblem: 'x'.repeat(2001) }))).status).toBe(400);
    expect((await post(actor.token, datos({ reportedProblem: 'x'.repeat(2000) }))).status).toBe(201);
  });

  test('el mecánico no puede crear órdenes (403) y sin token responde 401', async () => {
    const { datos } = await base();
    const mecanico = await loginAs('MECHANIC', { username: 'mec.sesion' });
    expect((await post(mecanico.token, datos())).status).toBe(403);
    expect((await request(app).post('/api/orders').send(datos())).status).toBe(401);
  });

  test('vincula la orden a una cita y la deja EN_PROCESO', async () => {
    const { actor, client, vehicle, datos } = await base();
    const cita = await createAppointment({ clientId: client.id, vehicleId: vehicle.id, status: 'CONFIRMADA' });
    const res = await post(actor.token, datos({ appointmentId: cita.id }));
    expect(res.status).toBe(201);
    expect(res.body.data.appointmentId).toBe(cita.id);
    const [filas] = await pool.query('SELECT status FROM appointments WHERE id = ?', [cita.id]);
    expect(filas[0].status).toBe('EN_PROCESO');
  });

  test('rechaza una cita cancelada, completada, ya vinculada o de otro cliente o vehículo', async () => {
    const { actor, client, vehicle, datos } = await base();
    for (const estado of ['CANCELADA', 'COMPLETADA', 'EN_PROCESO']) {
      const cita = await createAppointment({ clientId: client.id, vehicleId: vehicle.id, status: estado });
      expect((await post(actor.token, datos({ appointmentId: cita.id }))).status).toBe(409);
    }
    const otroCliente = await createClient({ name: 'Otro', phone: '5511112222' });
    const otroVehiculo = await createVehicle({ clientId: otroCliente.id, licensePlate: 'ZZZ999' });
    const ajena = await createAppointment({ clientId: otroCliente.id, vehicleId: otroVehiculo.id });
    expect((await post(actor.token, datos({ appointmentId: ajena.id }))).status).toBe(400);
    expect((await post(actor.token, datos({ appointmentId: 9999 }))).status).toBe(400);
  });

  test('una falla a mitad de la creación no deja la orden ni cambia el kilometraje (transacción)', async () => {
    const { actor, vehicle, datos } = await base({ kilometraje: 1000 });
    // Se renombra la tabla del historial para provocar un error después de insertar la orden.
    await pool.query('RENAME TABLE order_status_history TO order_status_history_tmp');
    let res;
    try {
      res = await post(actor.token, datos({ entryMileage: 2000 }));
    } finally {
      await pool.query('RENAME TABLE order_status_history_tmp TO order_status_history');
    }
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/order_status_history|ER_/);

    const [ordenes] = await pool.query('SELECT COUNT(*) AS total FROM service_orders');
    expect(ordenes[0].total).toBe(0);
    expect(await kilometrajeDe(vehicle.id)).toBe(1000);
    const [folios] = await pool.query('SELECT COUNT(*) AS total FROM folio_counters');
    expect(folios[0].total).toBe(0);
  });
});
