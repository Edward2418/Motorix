import request from 'supertest';
import app from '../../app.js';
import {
  pool,
  resetTables,
  closePool,
  createClient,
  createVehicle,
  createOrder,
  createMaintenance,
  createAppointment,
  createPart,
  setOrderLastChange
} from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';
import { visibleTypes } from '../../services/notificationRules.js';
import { todayLocal } from '../../services/maintenanceService.js';

const centro = async (token) => (await request(app).get('/api/notifications').set(bearer(token))).body.data;
const conteo = async (token) => (await request(app).get('/api/notifications/count').set(bearer(token))).body.data.unread;
const claves = (data) => data.groups.flatMap((g) => g.items.map((a) => a.key)).sort();
const tipos = (data) => data.groups.map((g) => g.type);

let consecutivo = 0;
// Orden detenida (hace 5 días) de un mecánico, con su propio vehículo (la base permite una orden abierta por vehículo).
async function ordenDetenida(cliente, mecanico, status = 'DIAGNOSTICO') {
  consecutivo += 1;
  const vehiculo = await createVehicle({ clientId: cliente.id, licensePlate: `MEC${5000 + consecutivo}` });
  const orden = await createOrder({ clientId: cliente.id, vehicleId: vehiculo.id, mechanicId: mecanico.id, status });
  await setOrderLastChange({ orderId: orden.id, daysAgo: 5 });
  return { orden, vehiculo };
}

// Datos que un mecánico nunca debe ver: stock, mantenimientos y citas del día.
async function datosAjenos(cliente, mecanico) {
  const { orden, vehiculo } = await ordenDetenida(cliente, mecanico, 'ENTREGADO');
  await createPart({ code: 'LOW-1', stock: 1, minStock: 3 });
  await createPart({ code: 'OUT-1', stock: 0, minStock: 3 });
  const ayer = todayLocal(new Date(Date.now() - 86400000));
  await createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, dueDate: ayer });
  const mediodia = new Date();
  mediodia.setHours(12, 0, 0, 0);
  await createAppointment({ clientId: cliente.id, vehicleId: vehiculo.id, scheduledAt: mediodia });
}

beforeEach(async () => {
  consecutivo = 0;
  await resetTables();
});
afterAll(closePool);

describe('avisos del mecánico: solo lo suyo', () => {
  test('cada mecánico recibe solo el aviso de su propia orden detenida', async () => {
    const m1 = await loginAs('MECHANIC', { username: 'mecanico1' });
    const m2 = await loginAs('MECHANIC', { username: 'mecanico2' });
    const cliente = await createClient({ name: 'Cliente Mecánico', phone: '5550000004' });
    const o1 = await ordenDetenida(cliente, m1.user);
    const o2 = await ordenDetenida(cliente, m2.user);

    const d1 = await centro(m1.token);
    const d2 = await centro(m2.token);

    expect(claves(d1)).toEqual([`ORDER:${o1.orden.id}`]);
    expect(claves(d2)).toEqual([`ORDER:${o2.orden.id}`]);
  });

  test('aunque existan, no recibe STOCK_LOW, STOCK_OUT, APPOINTMENT_TODAY ni MAINTENANCE_*', async () => {
    const m1 = await loginAs('MECHANIC', { username: 'mecanico1' });
    const cliente = await createClient({ name: 'Cliente Mecánico', phone: '5550000004' });
    await ordenDetenida(cliente, m1.user);
    await datosAjenos(cliente, m1.user);

    const data = await centro(m1.token);

    expect(tipos(data)).toEqual(['ORDER_STALE']);
  });

  test('el contador cuenta solo sus avisos', async () => {
    const m1 = await loginAs('MECHANIC', { username: 'mecanico1' });
    const m2 = await loginAs('MECHANIC', { username: 'mecanico2' });
    const cliente = await createClient({ name: 'Cliente Mecánico', phone: '5550000004' });
    await ordenDetenida(cliente, m1.user);
    await ordenDetenida(cliente, m1.user, 'EN_REPARACION');
    await ordenDetenida(cliente, m2.user);
    await datosAjenos(cliente, m1.user);

    expect(await conteo(m1.token)).toBe(2);
    expect(await conteo(m2.token)).toBe(1);
  });

  test('un mecánico sin órdenes detenidas no recibe nada aunque haya avisos para otros roles', async () => {
    const m1 = await loginAs('MECHANIC', { username: 'mecanico1' });
    const cliente = await createClient({ name: 'Cliente Mecánico', phone: '5550000004' });
    await datosAjenos(cliente, m1.user);

    expect(await centro(m1.token)).toEqual({ unread: 0, groups: [] });
    expect(await conteo(m1.token)).toBe(0);
  });

  test('marcar la clave de una orden de otro mecánico responde 404 NOTIFICATION_NOT_FOUND', async () => {
    const m1 = await loginAs('MECHANIC', { username: 'mecanico1' });
    const m2 = await loginAs('MECHANIC', { username: 'mecanico2' });
    const cliente = await createClient({ name: 'Cliente Mecánico', phone: '5550000004' });
    const ajena = await ordenDetenida(cliente, m2.user);

    const res = await request(app).post('/api/notifications/read').set(bearer(m1.token)).send({ key: `ORDER:${ajena.orden.id}` });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOTIFICATION_NOT_FOUND');
    const [filas] = await pool.query('SELECT COUNT(*) AS n FROM notification_reads WHERE user_id = ?', [m1.user.id]);
    expect(Number(filas[0].n)).toBe(0);
  });

  test('marcar un aviso de stock, de cita o de mantenimiento responde 404', async () => {
    const m1 = await loginAs('MECHANIC', { username: 'mecanico1' });
    const cliente = await createClient({ name: 'Cliente Mecánico', phone: '5550000004' });
    await datosAjenos(cliente, m1.user);
    const [[parte]] = await pool.query("SELECT id FROM parts WHERE code = 'LOW-1'");
    const [[cita]] = await pool.query('SELECT id FROM appointments LIMIT 1');
    const [[mantenimiento]] = await pool.query('SELECT id FROM maintenance LIMIT 1');

    for (const key of [`STOCK:${parte.id}`, `APPT:${cita.id}`, `MAINT:${mantenimiento.id}`]) {
      const res = await request(app).post('/api/notifications/read').set(bearer(m1.token)).send({ key });
      expect({ key, status: res.status, code: res.body.error?.code }).toEqual({ key, status: 404, code: 'NOTIFICATION_NOT_FOUND' });
    }
  });

  test('puede marcar como leído el aviso de su propia orden', async () => {
    const m1 = await loginAs('MECHANIC', { username: 'mecanico1' });
    const cliente = await createClient({ name: 'Cliente Mecánico', phone: '5550000004' });
    const propia = await ordenDetenida(cliente, m1.user);

    const res = await request(app).post('/api/notifications/read').set(bearer(m1.token)).send({ key: `ORDER:${propia.orden.id}` });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ key: `ORDER:${propia.orden.id}`, read: true, unread: 0 });
  });

  test('reasignar la orden a otro mecánico cambia el destinatario del aviso', async () => {
    const admin = await loginAs('ADMIN');
    const m1 = await loginAs('MECHANIC', { username: 'mecanico1' });
    const m2 = await loginAs('MECHANIC', { username: 'mecanico2' });
    const cliente = await createClient({ name: 'Cliente Mecánico', phone: '5550000004' });
    const { orden } = await ordenDetenida(cliente, m1.user);
    expect(claves(await centro(m1.token))).toEqual([`ORDER:${orden.id}`]);

    const res = await request(app).put(`/api/orders/${orden.id}/mechanic`).set(bearer(admin.token)).send({ mechanicId: m2.user.id });
    expect(res.status).toBe(200);
    // La reasignación no es un cambio de estado: el plazo de la orden sigue contando igual.
    await setOrderLastChange({ orderId: orden.id, daysAgo: 5 });

    expect(await centro(m1.token)).toEqual({ unread: 0, groups: [] });
    expect(claves(await centro(m2.token))).toEqual([`ORDER:${orden.id}`]);
  });
});

// SC-003: ningún rol recibe un tipo fuera de los que le corresponden, con datos de todos los tipos presentes.
describe('recorrido de permisos por rol', () => {
  test.each(['ADMIN', 'RECEPTIONIST', 'MECHANIC'])('el rol %s solo recibe tipos de visibleTypes(rol)', async (rol) => {
    const dueno = await loginAs('MECHANIC', { username: 'duenio-ordenes' });
    const cliente = await createClient({ name: 'Cliente Mecánico', phone: '5550000004' });
    await ordenDetenida(cliente, dueno.user);
    await datosAjenos(cliente, dueno.user);
    const actor = rol === 'MECHANIC' ? dueno : await loginAs(rol);

    const data = await centro(actor.token);
    const permitidos = visibleTypes(rol);

    expect(data.groups.length).toBeGreaterThan(0);
    for (const grupo of data.groups) {
      expect(permitidos).toContain(grupo.type);
      for (const aviso of grupo.items) {
        expect(permitidos).toContain(aviso.type);
      }
    }
    // El contador coincide con el centro y no cuenta tipos ajenos.
    expect(await conteo(actor.token)).toBe(data.unread);
  });

  test('el administrador recibe todos los tipos cuando existen', async () => {
    const dueno = await loginAs('MECHANIC', { username: 'duenio-ordenes' });
    const cliente = await createClient({ name: 'Cliente Mecánico', phone: '5550000004' });
    await ordenDetenida(cliente, dueno.user);
    await datosAjenos(cliente, dueno.user);
    const admin = await loginAs('ADMIN');

    const data = await centro(admin.token);

    expect(tipos(data).sort()).toEqual(
      ['APPOINTMENT_TODAY', 'MAINTENANCE_OVERDUE', 'ORDER_STALE', 'STOCK_LOW', 'STOCK_OUT'].sort()
    );
  });
});
