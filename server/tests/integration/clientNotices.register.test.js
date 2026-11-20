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

beforeEach(async () => {
  placa = 0;
  await resetTables();
});
afterAll(closePool);

const listar = async (token) => (await request(app).get('/api/client-notices').set(bearer(token))).body;
const registrar = (token, cuerpo) => request(app).post('/api/client-notices').set(bearer(token)).send(cuerpo);
const filas = async () => (await pool.query('SELECT * FROM client_notices'))[0];

let placa = 0;
async function vehiculoNuevo(cliente) {
  placa += 1;
  return createVehicle({ clientId: cliente.id, licensePlate: `REG${7000 + placa}` });
}

async function ordenTerminada() {
  const mecanico = await createMechanic();
  const cliente = await createClient({ name: 'Cliente Registro', phone: '5550004444' });
  const vehiculo = await vehiculoNuevo(cliente);
  const orden = await createOrder({ clientId: cliente.id, vehicleId: vehiculo.id, mechanicId: mecanico.id, status: 'TERMINADO' });
  return { mecanico, cliente, vehiculo, orden };
}

describe('registro de un aviso al cliente', () => {
  test('guarda quién avisó, cuándo y la nota, y saca al cliente de la lista', async () => {
    const { token, user } = await loginAs('RECEPTIONIST');
    const { cliente, orden } = await ordenTerminada();
    expect((await listar(token)).meta.total).toBe(1);

    const res = await registrar(token, { reason: 'ORDEN_TERMINADA', factKey: `ORDER:${orden.id}`, note: 'Pasa mañana' });

    expect(res.status).toBe(201);
    const guardadas = await filas();
    expect(guardadas).toHaveLength(1);
    expect(guardadas[0]).toMatchObject({
      client_id: cliente.id,
      reason: 'ORDEN_TERMINADA',
      fact_key: `ORDER:${orden.id}`,
      note: 'Pasa mañana',
      notified_by: user.id
    });
    expect(guardadas[0].notified_at).toBeInstanceOf(Date);
    expect((await listar(token)).data).toEqual([]);
  });

  test('el nombre de quien avisó viaja en la respuesta', async () => {
    const { token, user } = await loginAs('RECEPTIONIST', { username: 'recepcion-uno' });
    const { orden } = await ordenTerminada();

    const res = await registrar(token, { reason: 'ORDEN_TERMINADA', factKey: `ORDER:${orden.id}` });

    expect(res.body.data.notifiedBy).toBe(user.id);
    expect(res.body.data.notifiedByName).toBeTruthy();
  });

  test('registrar el mismo hecho otra vez responde 409 NOTICE_ALREADY_REGISTERED y no duplica', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const { orden } = await ordenTerminada();
    const cuerpo = { reason: 'ORDEN_TERMINADA', factKey: `ORDER:${orden.id}` };
    expect((await registrar(token, cuerpo)).status).toBe(201);

    const otra = await registrar(token, cuerpo);

    expect(otra.status).toBe(409);
    expect(otra.body.error.code).toBe('NOTICE_ALREADY_REGISTERED');
    expect(await filas()).toHaveLength(1);
  });

  test('un hecho que ya no está vigente responde 409 NOTICE_NOT_APPLICABLE y no guarda nada', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const { orden } = await ordenTerminada();
    await pool.query("UPDATE service_orders SET status = 'ENTREGADO' WHERE id = ?", [orden.id]);

    const res = await registrar(token, { reason: 'ORDEN_TERMINADA', factKey: `ORDER:${orden.id}` });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NOTICE_NOT_APPLICABLE');
    expect(await filas()).toHaveLength(0);
  });

  test('una cita de mañana cancelada ya no se puede registrar', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const cliente = await createClient({ name: 'Cliente Cita', phone: '5550005555' });
    const vehiculo = await vehiculoNuevo(cliente);
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    manana.setHours(12, 0, 0, 0);
    const cita = await createAppointment({ clientId: cliente.id, vehicleId: vehiculo.id, scheduledAt: manana, status: 'CANCELADA' });

    const res = await registrar(token, { reason: 'CITA_MANANA', factKey: `APPT:${cita.id}` });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NOTICE_NOT_APPLICABLE');
    expect(await filas()).toHaveLength(0);
  });

  test('un hecho que nunca existió responde 409 NOTICE_NOT_APPLICABLE', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await registrar(token, { reason: 'ORDEN_TERMINADA', factKey: 'ORDER:999999' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NOTICE_NOT_APPLICABLE');
  });

  test('un motivo que no corresponde al tipo de hecho responde 400 VALIDATION_ERROR', async () => {
    const { token } = await loginAs('ADMIN');
    const { orden } = await ordenTerminada();
    const res = await registrar(token, { reason: 'CITA_MANANA', factKey: `ORDER:${orden.id}` });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('dos solicitudes simultáneas del mismo hecho dejan un solo registro (una 201 y la otra 409)', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const { orden } = await ordenTerminada();
    const cuerpo = { reason: 'ORDEN_TERMINADA', factKey: `ORDER:${orden.id}` };

    const [a, b] = await Promise.all([registrar(token, cuerpo), registrar(token, cuerpo)]);

    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await filas()).toHaveLength(1);
  });

  test('una orden nueva del mismo cliente vuelve a aparecer aunque la anterior ya se avisó', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const { mecanico, cliente, orden } = await ordenTerminada();
    await registrar(token, { reason: 'ORDEN_TERMINADA', factKey: `ORDER:${orden.id}` });
    const otroVehiculo = await vehiculoNuevo(cliente);
    const nueva = await createOrder({ clientId: cliente.id, vehicleId: otroVehiculo.id, mechanicId: mecanico.id, status: 'TERMINADO' });

    const lista = await listar(token);

    expect(lista.data.map((n) => n.factKey)).toEqual([`ORDER:${nueva.id}`]);
  });

  test('el mecánico recibe 403 en GET y POST, y la recepción y la administración pueden usar ambos', async () => {
    const { orden } = await ordenTerminada();
    const mecanico = await loginAs('MECHANIC', { username: 'mecanico-permisos' });
    expect((await request(app).get('/api/client-notices').set(bearer(mecanico.token))).status).toBe(403);
    expect((await registrar(mecanico.token, { reason: 'ORDEN_TERMINADA', factKey: `ORDER:${orden.id}` })).status).toBe(403);
    expect(await filas()).toHaveLength(0);

    const recepcion = await loginAs('RECEPTIONIST');
    expect((await request(app).get('/api/client-notices').set(bearer(recepcion.token))).status).toBe(200);
    expect((await registrar(recepcion.token, { reason: 'ORDEN_TERMINADA', factKey: `ORDER:${orden.id}` })).status).toBe(201);

    const admin = await loginAs('ADMIN');
    expect((await request(app).get('/api/client-notices').set(bearer(admin.token))).status).toBe(200);
  });
});
