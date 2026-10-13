import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createClient, createVehicle, createMechanic, createOrder } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';

afterAll(closePool);

// Fecha local (AAAA-MM-DD) a `dias` días de hoy.
const en = (dias) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
};

const programar = (token, orderId, body) => request(app).post(`/api/orders/${orderId}/maintenance`).set(bearer(token)).send(body);
const atender = (token, id, body = {}) => request(app).post(`/api/maintenance/${id}/fulfill`).set(bearer(token)).send(body);
const cancelar = (token, id, reason = 'El cliente lo pospuso') => request(app).post(`/api/maintenance/${id}/cancel`).set(bearer(token)).send({ reason });

const filaDe = async (id) => (await pool.query('SELECT * FROM maintenance WHERE id = ?', [id]))[0][0];

// Los kilometrajes de la prueba: la orden entra con 1000 km y el vehículo está en 2000 km.
async function escenario(status = 'EN_REPARACION') {
  const datos = await escenarioOrden(status);
  await pool.query('UPDATE vehicles SET current_mileage = 2000 WHERE id = ?', [datos.vehicle.id]);
  return datos;
}

describe('programar el próximo mantenimiento', () => {
  beforeEach(resetTables);

  test('por fecha, por kilometraje y por ambos', async () => {
    const { orden, vehicle, tokens } = await escenario();
    const porFecha = await programar(tokens.mecanico, orden.id, { description: 'Cambio de aceite', dueDate: en(90) });
    const porKm = await programar(tokens.mecanico, orden.id, { description: 'Frenos', dueMileage: 8000 });
    const ambos = await programar(tokens.mecanico, orden.id, { description: 'Afinación', dueDate: en(180), dueMileage: 12000, notes: ' Revisar bujías ' });

    expect(porFecha.status).toBe(201);
    expect(porFecha.body.data).toMatchObject({ dueDate: en(90), dueMileage: null, vehicleId: vehicle.id, orderId: orden.id, orderFolio: orden.folio });
    expect(porKm.body.data).toMatchObject({ dueDate: null, dueMileage: 8000 });
    expect(ambos.body.data).toMatchObject({ dueDate: en(180), dueMileage: 12000, notes: 'Revisar bujías' });
  });

  test('sin fecha ni kilometraje se rechaza con 400', async () => {
    const { orden, tokens } = await escenario();
    const res = await programar(tokens.mecanico, orden.id, { description: 'Cambio de aceite' });
    expect(res.status).toBe(400);
  });

  test('una fecha anterior a hoy se rechaza y la fecha de hoy se acepta', async () => {
    const { orden, tokens } = await escenario();
    const ayer = await programar(tokens.mecanico, orden.id, { description: 'Cambio de aceite', dueDate: en(-1) });
    expect(ayer.status).toBe(400);
    expect(ayer.body.error.details[0].field).toBe('dueDate');
    const hoy = await programar(tokens.mecanico, orden.id, { description: 'Cambio de aceite', dueDate: en(0) });
    expect(hoy.status).toBe(201);
  });

  test('un kilometraje igual o menor al actual del vehículo se rechaza', async () => {
    const { orden, tokens } = await escenario();
    for (const dueMileage of [2000, 1500]) {
      const res = await programar(tokens.mecanico, orden.id, { description: `Frenos ${dueMileage}`, dueMileage });
      expect({ dueMileage, status: res.status }).toEqual({ dueMileage, status: 400 });
      expect(res.body.error.details[0]).toMatchObject({ field: 'dueMileage', message: expect.stringContaining('2,000') });
    }
    expect((await programar(tokens.mecanico, orden.id, { description: 'Frenos', dueMileage: 2001 })).status).toBe(201);
  });

  test('el mismo mantenimiento pendiente del mismo vehículo se rechaza sin distinguir mayúsculas ni espacios', async () => {
    const { orden, tokens } = await escenario();
    const primero = await programar(tokens.mecanico, orden.id, { description: 'Cambio de aceite', dueDate: en(90) });
    for (const description of ['Cambio de aceite', '  CAMBIO DE ACEITE  ', 'cambio de aceite']) {
      const res = await programar(tokens.mecanico, orden.id, { description, dueDate: en(30) });
      expect({ description, status: res.status, code: res.body.error?.code }).toEqual({ description, status: 409, code: 'DUPLICATE_MAINTENANCE' });
      expect(res.body.error.message).toContain(String(primero.body.data.id));
    }
    expect((await pool.query('SELECT COUNT(*) AS total FROM maintenance'))[0][0].total).toBe(1);
  });

  test('se permite repetir la descripción si el anterior ya fue atendido o cancelado', async () => {
    const { orden, tokens } = await escenario();
    const a = await programar(tokens.mecanico, orden.id, { description: 'Cambio de aceite', dueDate: en(90) });
    await atender(tokens.mecanico, a.body.data.id);
    const b = await programar(tokens.mecanico, orden.id, { description: 'Cambio de aceite', dueDate: en(180) });
    expect(b.status).toBe(201);
    await cancelar(tokens.mecanico, b.body.data.id);
    expect((await programar(tokens.mecanico, orden.id, { description: 'Cambio de aceite', dueDate: en(270) })).status).toBe(201);
  });

  test('dos pendientes con descripciones distintas son válidos', async () => {
    const { orden, tokens } = await escenario();
    expect((await programar(tokens.mecanico, orden.id, { description: 'Cambio de aceite', dueDate: en(90) })).status).toBe(201);
    expect((await programar(tokens.mecanico, orden.id, { description: 'Rotación de llantas', dueDate: en(90) })).status).toBe(201);
  });

  test('el mecánico solo programa desde sus órdenes; administración y recepción desde cualquiera no cancelada', async () => {
    const { orden, tokens } = await escenario();
    const cuerpo = (n) => ({ description: `Servicio ${n}`, dueDate: en(30) });
    expect((await programar(tokens.otro, orden.id, cuerpo(1))).status).toBe(403);
    expect((await programar(tokens.mecanico, orden.id, cuerpo(2))).status).toBe(201);
    expect((await programar(tokens.admin, orden.id, cuerpo(3))).status).toBe(201);
    expect((await programar(tokens.recepcion, orden.id, cuerpo(4))).status).toBe(201);
  });

  test('el mecánico puede programar desde su orden ya entregada, pero no desde una cancelada', async () => {
    const entregada = await escenario('ENTREGADO');
    expect((await programar(entregada.tokens.mecanico, entregada.orden.id, { description: 'Cambio de aceite', dueDate: en(90) })).status).toBe(201);
    await resetTables();
    const cancelada = await escenario('CANCELADA');
    const res = await programar(cancelada.tokens.admin, cancelada.orden.id, { description: 'Cambio de aceite', dueDate: en(90) });
    expect(res.status).toBe(409);
  });

  test('no se programa para un vehículo desactivado ni en una orden inexistente', async () => {
    const { orden, vehicle, tokens } = await escenario('ENTREGADO');
    await request(app).patch(`/api/vehicles/${vehicle.id}/status`).set(bearer(tokens.admin)).send({ active: false });
    const res = await programar(tokens.admin, orden.id, { description: 'Cambio de aceite', dueDate: en(90) });
    expect(res.status).toBe(409);
    expect((await programar(tokens.admin, 99999, { description: 'Cambio de aceite', dueDate: en(90) })).status).toBe(404);
  });

  test('el detalle de la orden incluye los mantenimientos programados desde ella', async () => {
    const { orden, tokens } = await escenario();
    await programar(tokens.mecanico, orden.id, { description: 'Cambio de aceite', dueDate: en(90), dueMileage: 9000 });
    const detalle = await request(app).get(`/api/orders/${orden.id}`).set(bearer(tokens.recepcion));
    expect(detalle.body.data.maintenance).toHaveLength(1);
    expect(detalle.body.data.maintenance[0]).toMatchObject({ description: 'Cambio de aceite', status: 'PROGRAMADO', visualStatus: expect.any(String) });
  });
});

describe('atender y cancelar mantenimientos', () => {
  beforeEach(resetTables);

  test('atender deja el mantenimiento ATENDIDO, con quién y cuándo, y no vuelve a cambiar', async () => {
    const { orden, tokens } = await escenario();
    const m = await programar(tokens.mecanico, orden.id, { description: 'Cambio de aceite', dueDate: en(90) });
    const res = await atender(tokens.mecanico, m.body.data.id);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'ATENDIDO', visualStatus: null });
    const fila = await filaDe(m.body.data.id);
    expect(fila.closed_by).not.toBeNull();
    expect(fila.closed_at).not.toBeNull();
    expect((await atender(tokens.admin, m.body.data.id)).status).toBe(409);
    expect((await cancelar(tokens.admin, m.body.data.id)).status).toBe(409);
  });

  test('atender puede indicar la orden que lo cumplió, siempre del mismo vehículo', async () => {
    const { orden, client, vehicle, mecanico, tokens } = await escenario('ENTREGADO');
    const m = await programar(tokens.mecanico, orden.id, { description: 'Cambio de aceite', dueDate: en(90) });
    const posterior = await createOrder({ clientId: client.id, vehicleId: vehicle.id, mechanicId: mecanico.id, status: 'EN_REPARACION' });
    const otroVehiculo = await createVehicle({ clientId: client.id, licensePlate: 'OTR0001' });
    const ajena = await createOrder({ clientId: client.id, vehicleId: otroVehiculo.id, mechanicId: mecanico.id, status: 'EN_REPARACION' });

    const mala = await atender(tokens.admin, m.body.data.id, { orderId: ajena.id });
    expect(mala.status).toBe(400);
    expect(mala.body.error.details[0].field).toBe('orderId');
    const inexistente = await atender(tokens.admin, m.body.data.id, { orderId: 99999 });
    expect(inexistente.status).toBe(400);

    const ok = await atender(tokens.admin, m.body.data.id, { orderId: posterior.id });
    expect(ok.status).toBe(200);
    expect(ok.body.data.fulfilledOrderId).toBe(posterior.id);
  });

  test('cancelar exige el motivo y lo guarda', async () => {
    const { orden, tokens } = await escenario();
    const m = await programar(tokens.mecanico, orden.id, { description: 'Cambio de aceite', dueDate: en(90) });
    const sinMotivo = await request(app).post(`/api/maintenance/${m.body.data.id}/cancel`).set(bearer(tokens.mecanico)).send({ reason: '  ' });
    expect(sinMotivo.status).toBe(400);
    const res = await cancelar(tokens.mecanico, m.body.data.id, 'El cliente lo pospuso');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'CANCELADO', cancelReason: 'El cliente lo pospuso' });
  });

  test('administración, recepción y el mecánico dueño de la orden de origen pueden cerrarlos; otro mecánico no', async () => {
    const { orden, tokens } = await escenario();
    const crear = async (n) => (await programar(tokens.admin, orden.id, { description: `Servicio ${n}`, dueDate: en(90) })).body.data.id;
    const [a, b, c, d] = [await crear(1), await crear(2), await crear(3), await crear(4)];
    expect((await atender(tokens.otro, a)).status).toBe(403);
    expect((await cancelar(tokens.otro, a)).status).toBe(403);
    expect((await atender(tokens.mecanico, a)).status).toBe(200);
    expect((await atender(tokens.admin, b)).status).toBe(200);
    expect((await atender(tokens.recepcion, c)).status).toBe(200);
    expect((await cancelar(tokens.mecanico, d)).status).toBe(200);
  });

  test('un mantenimiento inexistente responde 404', async () => {
    const { tokens } = await escenario();
    expect((await atender(tokens.admin, 99999)).status).toBe(404);
    expect((await cancelar(tokens.admin, 99999)).status).toBe(404);
  });

  test('atender y cancelar a la vez: uno tiene éxito y el otro recibe 409', async () => {
    const { orden, tokens } = await escenario();
    const m = await programar(tokens.mecanico, orden.id, { description: 'Cambio de aceite', dueDate: en(90) });
    const [a, b] = await Promise.all([atender(tokens.admin, m.body.data.id), cancelar(tokens.recepcion, m.body.data.id)]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
  });

  test('no existe ninguna ruta para eliminar mantenimientos', async () => {
    const { orden, tokens } = await escenario();
    const m = await programar(tokens.mecanico, orden.id, { description: 'Cambio de aceite', dueDate: en(90) });
    expect((await request(app).delete(`/api/maintenance/${m.body.data.id}`).set(bearer(tokens.admin))).status).toBe(404);
    expect((await request(app).delete('/api/maintenance').set(bearer(tokens.admin))).status).toBe(404);
  });
});

describe('cancelar la orden cancela sus mantenimientos pendientes', () => {
  beforeEach(resetTables);

  test('solo los pendientes de esa orden pasan a CANCELADO con el motivo «Orden cancelada»', async () => {
    const { orden, client, mecanico, tokens } = await escenario('EN_REPARACION');
    const pendiente = await programar(tokens.mecanico, orden.id, { description: 'Cambio de aceite', dueDate: en(90) });
    const atendido = await programar(tokens.mecanico, orden.id, { description: 'Frenos', dueDate: en(60) });
    await atender(tokens.mecanico, atendido.body.data.id);

    const otroVehiculo = await createVehicle({ clientId: client.id, licensePlate: 'OTR0002' });
    const otraOrden = await createOrder({ clientId: client.id, vehicleId: otroVehiculo.id, mechanicId: mecanico.id, status: 'EN_REPARACION' });
    const deOtra = await programar(tokens.admin, otraOrden.id, { description: 'Afinación', dueDate: en(60) });

    const res = await request(app)
      .post(`/api/orders/${orden.id}/status`)
      .set(bearer(tokens.recepcion))
      .send({ status: 'CANCELADA', reason: 'El cliente se arrepintió' });
    expect(res.status).toBe(200);

    expect(await filaDe(pendiente.body.data.id)).toMatchObject({ status: 'CANCELADO', cancel_reason: 'Orden cancelada' });
    expect((await filaDe(pendiente.body.data.id)).closed_at).not.toBeNull();
    expect((await filaDe(atendido.body.data.id)).status).toBe('ATENDIDO');
    expect((await filaDe(deOtra.body.data.id)).status).toBe('PROGRAMADO');
  });

  test('una orden entregada que se queda con mantenimientos pendientes no los cancela', async () => {
    const { orden, tokens } = await escenario('TERMINADO');
    const m = await programar(tokens.admin, orden.id, { description: 'Cambio de aceite', dueDate: en(90) });
    const entregada = await request(app).post(`/api/orders/${orden.id}/status`).set(bearer(tokens.recepcion)).send({ status: 'ENTREGADO' });
    expect(entregada.status).toBe(200);
    expect((await filaDe(m.body.data.id)).status).toBe('PROGRAMADO');
  });
});

describe('restricciones de la base de datos sobre los mantenimientos', () => {
  beforeEach(resetTables);

  test('la base exige al menos una fecha o un kilometraje', async () => {
    const { orden, vehicle, mecanico } = await escenario();
    await expect(
      pool.query("INSERT INTO maintenance (vehicle_id, order_id, description, created_by) VALUES (?, ?, 'Sin objetivo', ?)", [vehicle.id, orden.id, mecanico.id])
    ).rejects.toBeDefined();
  });

  test('la base impide dos pendientes con la misma descripción en el mismo vehículo', async () => {
    const { orden, vehicle, mecanico } = await escenario();
    const insertar = (descripcion) =>
      pool.query("INSERT INTO maintenance (vehicle_id, order_id, description, due_mileage, created_by) VALUES (?, ?, ?, 9000, ?)", [
        vehicle.id,
        orden.id,
        descripcion,
        mecanico.id
      ]);
    await insertar('Cambio de aceite');
    await expect(insertar('CAMBIO DE ACEITE')).rejects.toBeDefined();
  });
});
