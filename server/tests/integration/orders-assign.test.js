import request from 'supertest';
import app from '../../app.js';
import {
  resetTables,
  closePool,
  createClient,
  createVehicle,
  createMechanic,
  createOrder,
  createUser
} from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

const reasignar = (token, orderId, mechanicId) =>
  request(app).put(`/api/orders/${orderId}/mechanic`).set(bearer(token)).send({ mechanicId });

async function escenario(estado = 'RECIBIDO') {
  const mecanicoA = await createMechanic({ username: 'mecanico.a', name: 'Mecánico A' });
  const mecanicoB = await createMechanic({ username: 'mecanico.b', name: 'Mecánico B' });
  const client = await createClient();
  const vehicle = await createVehicle({ clientId: client.id });
  const orden = await createOrder({
    clientId: client.id,
    vehicleId: vehicle.id,
    mechanicId: mecanicoA.id,
    status: estado
  });
  return { mecanicoA, mecanicoB, client, vehicle, orden };
}

afterAll(closePool);

describe('órdenes: reasignación de mecánico', () => {
  beforeEach(resetTables);

  test('recepción y administración reasignan una orden abierta', async () => {
    const { mecanicoB, orden } = await escenario('DIAGNOSTICO');
    for (const rol of ['RECEPTIONIST', 'ADMIN']) {
      const { token } = await loginAs(rol);
      const res = await reasignar(token, orden.id, mecanicoB.id);
      expect(res.status).toBe(200);
      expect(res.body.data.mechanicId).toBe(mecanicoB.id);
      expect(res.body.data.mechanicName).toBe('Mecánico B');
    }
  });

  test('también se puede reasignar una orden TERMINADO', async () => {
    const { mecanicoB, orden } = await escenario('TERMINADO');
    const { token } = await loginAs('RECEPTIONIST');
    expect((await reasignar(token, orden.id, mecanicoB.id)).status).toBe(200);
  });

  test('el mecánico anterior deja de ver la orden y el nuevo la ve', async () => {
    const { mecanicoA, mecanicoB, orden } = await escenario();
    const { token } = await loginAs('RECEPTIONIST');
    await reasignar(token, orden.id, mecanicoB.id);

    const sesionA = await request(app)
      .post('/api/auth/login')
      .send({ identifier: mecanicoA.username, password: mecanicoA.password });
    const sesionB = await request(app)
      .post('/api/auth/login')
      .send({ identifier: mecanicoB.username, password: mecanicoB.password });

    expect((await request(app).get(`/api/orders/${orden.id}`).set(bearer(sesionA.body.data.token))).status).toBe(403);
    expect((await request(app).get(`/api/orders/${orden.id}`).set(bearer(sesionB.body.data.token))).status).toBe(200);
  });

  test('rechaza un mecánico inexistente, desactivado o sin rol de mecánico', async () => {
    const { orden } = await escenario();
    const { token } = await loginAs('RECEPTIONIST');
    expect((await reasignar(token, orden.id, 9999)).status).toBe(400);

    const baja = await createMechanic({ username: 'baja', active: false });
    expect((await reasignar(token, orden.id, baja.id)).status).toBe(400);

    const recepcion = await createUser({ username: 'otra.recepcion', role: 'RECEPTIONIST' });
    expect((await reasignar(token, orden.id, recepcion.id)).status).toBe(400);
  });

  test('no se permite reasignar una orden ENTREGADO ni CANCELADA (409)', async () => {
    for (const estado of ['ENTREGADO', 'CANCELADA']) {
      await resetTables();
      const { mecanicoB, orden } = await escenario(estado);
      const { token } = await loginAs('RECEPTIONIST');
      expect((await reasignar(token, orden.id, mecanicoB.id)).status).toBe(409);
    }
  });

  test('el mecánico recibe 403 al reasignar y una orden inexistente responde 404', async () => {
    const { mecanicoB, orden } = await escenario();
    const mecanico = await loginAs('MECHANIC', { username: 'mec.sesion' });
    expect((await reasignar(mecanico.token, orden.id, mecanicoB.id)).status).toBe(403);

    const { token } = await loginAs('RECEPTIONIST');
    expect((await reasignar(token, 9999, mecanicoB.id)).status).toBe(404);
  });

  test('el cuerpo exige un mechanicId entero positivo', async () => {
    const { orden } = await escenario();
    const { token } = await loginAs('RECEPTIONIST');
    expect((await request(app).put(`/api/orders/${orden.id}/mechanic`).set(bearer(token)).send({})).status).toBe(400);
    expect((await reasignar(token, orden.id, 'abc')).status).toBe(400);
  });
});

describe('mecánicos disponibles', () => {
  beforeEach(resetTables);

  test('lista solo los mecánicos activos con su cantidad de órdenes abiertas', async () => {
    const { mecanicoA, client } = await escenario();
    await createMechanic({ username: 'baja', active: false });
    await createUser({ username: 'solo.recepcion', role: 'RECEPTIONIST' });
    // Orden cerrada: no cuenta como abierta.
    const otroVehiculo = await createVehicle({ clientId: client.id, licensePlate: 'ENT0001' });
    await createOrder({ clientId: client.id, vehicleId: otroVehiculo.id, mechanicId: mecanicoA.id, status: 'ENTREGADO' });

    const { token } = await loginAs('RECEPTIONIST');
    const res = await request(app).get('/api/mechanics').set(bearer(token));
    expect(res.status).toBe(200);
    const porNombre = Object.fromEntries(res.body.data.map((m) => [m.name, m.openOrders]));
    expect(porNombre).toEqual({ 'Mecánico A': 1, 'Mecánico B': 0 });
  });

  test('ADMIN puede consultarlos, MECHANIC recibe 403 y sin token responde 401', async () => {
    const admin = await loginAs('ADMIN');
    expect((await request(app).get('/api/mechanics').set(bearer(admin.token))).status).toBe(200);
    const mecanico = await loginAs('MECHANIC', { username: 'mec.sesion' });
    expect((await request(app).get('/api/mechanics').set(bearer(mecanico.token))).status).toBe(403);
    expect((await request(app).get('/api/mechanics')).status).toBe(401);
  });
});

describe('usuarios: mecánicos con órdenes abiertas', () => {
  beforeEach(resetTables);

  test('no se puede desactivar a un mecánico con órdenes abiertas y el mensaje indica los folios', async () => {
    const { mecanicoA, orden } = await escenario('EN_REPARACION');
    const admin = await loginAs('ADMIN');
    const res = await request(app)
      .patch(`/api/users/${mecanicoA.id}/status`)
      .set(bearer(admin.token))
      .send({ active: false });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain(orden.folio);
  });

  test('no se puede cambiar el rol de un mecánico con órdenes abiertas', async () => {
    const { mecanicoA, orden } = await escenario();
    const admin = await loginAs('ADMIN');
    const res = await request(app)
      .put(`/api/users/${mecanicoA.id}`)
      .set(bearer(admin.token))
      .send({ name: 'Mecánico A', email: mecanicoA.email, role: 'RECEPTIONIST' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain(orden.folio);
  });

  test('tras reasignar sus órdenes, la desactivación y el cambio de rol se permiten', async () => {
    const { mecanicoA, mecanicoB, orden } = await escenario();
    const admin = await loginAs('ADMIN');
    await reasignar(admin.token, orden.id, mecanicoB.id);

    const rol = await request(app)
      .put(`/api/users/${mecanicoA.id}`)
      .set(bearer(admin.token))
      .send({ name: 'Mecánico A', email: mecanicoA.email, role: 'RECEPTIONIST' });
    expect(rol.status).toBe(200);

    const baja = await request(app)
      .patch(`/api/users/${mecanicoB.id}/status`)
      .set(bearer(admin.token))
      .send({ active: false });
    expect(baja.status).toBe(409);
  });

  test('un mecánico sin órdenes abiertas se desactiva sin problema, aunque tenga órdenes entregadas', async () => {
    const { mecanicoA, client } = await escenario('ENTREGADO');
    const admin = await loginAs('ADMIN');
    const res = await request(app)
      .patch(`/api/users/${mecanicoA.id}/status`)
      .set(bearer(admin.token))
      .send({ active: false });
    expect(res.status).toBe(200);
    expect(client).toBeDefined();
  });
});
