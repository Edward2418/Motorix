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
  setOrderLastChange
} from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

const centro = async (token) => (await request(app).get('/api/notifications').set(bearer(token))).body.data;
const detenidas = (data) => data.groups.find((g) => g.type === 'ORDER_STALE');

async function base() {
  placa = 0;
  const mecanico = await createMechanic();
  const cliente = await createClient({ name: 'Cliente Detenido', phone: '5550000003' });
  const vehiculo = await createVehicle({ clientId: cliente.id, licensePlate: 'DET3001' });
  return { mecanico, cliente, vehiculo };
}

// Crea una orden en el estado dado y fija la antigüedad de su último cambio.
// La base solo permite una orden abierta por vehículo, así que cada orden usa su propio vehículo (el primero, el de `b`).
let placa = 0;
async function ordenCon(b, { status, dias }) {
  const vehiculoId = placa === 0 ? b.vehiculo.id : (await createVehicle({ clientId: b.cliente.id, licensePlate: `DET${3001 + placa}` })).id;
  placa += 1;
  const orden = await createOrder({ clientId: b.cliente.id, vehicleId: vehiculoId, mechanicId: b.mecanico.id, status });
  if (dias !== undefined) {
    await setOrderLastChange({ orderId: orden.id, daysAgo: dias });
  }
  return orden;
}

describe('avisos de órdenes detenidas', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('una orden en DIAGNOSTICO con último cambio hace 5 días genera ORDER_STALE', async () => {
    const { token } = await loginAs('ADMIN');
    const b = await base();
    const orden = await ordenCon(b, { status: 'DIAGNOSTICO', dias: 5 });

    const grupo = detenidas(await centro(token));

    expect(grupo.total).toBe(1);
    expect(grupo.items[0]).toMatchObject({
      key: `ORDER:${orden.id}`,
      type: 'ORDER_STALE',
      severity: 1,
      read: false,
      target: { module: 'orders', id: orden.id }
    });
  });

  test('el aviso trae el folio en el título y los días detenida en el detalle', async () => {
    const { token } = await loginAs('ADMIN');
    const b = await base();
    const orden = await ordenCon(b, { status: 'EN_REPARACION', dias: 5 });

    const aviso = detenidas(await centro(token)).items[0];

    expect(aviso.title).toContain(orden.folio);
    expect(aviso.detail).toContain('5 días');
    expect(aviso.detail).toContain('DET3001');
    expect(aviso.detail).toContain('Cliente Detenido');
  });

  test('con último cambio hace 2 días no genera aviso', async () => {
    const { token } = await loginAs('ADMIN');
    await ordenCon(await base(), { status: 'DIAGNOSTICO', dias: 2 });
    expect(await centro(token)).toEqual({ unread: 0, groups: [] });
  });

  // El límite exacto de 3 días se prueba en la prueba unitaria de `isStaleOrder` (aquí el reloj avanza entre fijar la
  // fecha y consultar, así que se usa un margen de una hora).
  test('con 2 días y 23 horas no genera aviso (debe pasar de 3 días)', async () => {
    const { token } = await loginAs('ADMIN');
    await ordenCon(await base(), { status: 'DIAGNOSTICO', dias: 3 - 1 / 24 });
    expect(await centro(token)).toEqual({ unread: 0, groups: [] });
  });

  test('con 3 días y una hora ya cuenta como detenida', async () => {
    const { token } = await loginAs('ADMIN');
    await ordenCon(await base(), { status: 'DIAGNOSTICO', dias: 3 + 1 / 24 });
    expect(detenidas(await centro(token)).total).toBe(1);
  });

  test('una orden RECIBIDO cuyo historial es antiguo usa esa fecha, y sin historial usa created_at', async () => {
    const { token } = await loginAs('ADMIN');
    const b = await base();
    const conHistorial = await ordenCon(b, { status: 'RECIBIDO', dias: 6 });
    const sinHistorial = await ordenCon(b, { status: 'RECIBIDO', dias: 6 });
    await pool.query('DELETE FROM order_status_history WHERE order_id = ?', [sinHistorial.id]);

    const claves = detenidas(await centro(token)).items.map((a) => a.key).sort();

    expect(claves).toEqual([`ORDER:${conHistorial.id}`, `ORDER:${sinHistorial.id}`].sort());
  });

  test('las órdenes TERMINADO, ENTREGADO y CANCELADA nunca generan aviso', async () => {
    const { token } = await loginAs('ADMIN');
    const b = await base();
    for (const status of ['TERMINADO', 'ENTREGADO', 'CANCELADA']) {
      await ordenCon(b, { status, dias: 20 });
    }
    expect(await centro(token)).toEqual({ unread: 0, groups: [] });
  });

  test('los cuatro estados abiertos pueden generar el aviso', async () => {
    const { token } = await loginAs('ADMIN');
    const b = await base();
    for (const status of ['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION']) {
      await ordenCon(b, { status, dias: 10 });
    }
    expect(detenidas(await centro(token)).total).toBe(4);
  });

  test('al cambiar la orden de estado el aviso desaparece y el plazo cuenta desde el nuevo estado', async () => {
    const { token } = await loginAs('ADMIN');
    const b = await base();
    const orden = await ordenCon(b, { status: 'DIAGNOSTICO', dias: 5 });
    expect(detenidas(await centro(token)).total).toBe(1);

    const cambio = await request(app).post(`/api/orders/${orden.id}/status`).set(bearer(token)).send({ status: 'EN_REPARACION' });
    expect(cambio.status).toBe(200);

    expect(await centro(token)).toEqual({ unread: 0, groups: [] });

    // Si el nuevo estado a su vez se queda sin cambios más de 3 días, vuelve a avisar.
    await pool.query('UPDATE order_status_history SET changed_at = ? WHERE order_id = ?', [new Date(Date.now() - 4 * 86400000), orden.id]);
    expect(detenidas(await centro(token)).total).toBe(1);
  });

  test('administración y recepción reciben el aviso', async () => {
    const b = await base();
    await ordenCon(b, { status: 'ESPERANDO_REFACCION', dias: 7 });
    for (const rol of ['ADMIN', 'RECEPTIONIST']) {
      const { token } = await loginAs(rol);
      expect({ rol, total: detenidas(await centro(token))?.total }).toEqual({ rol, total: 1 });
    }
  });

  test('marcar el aviso como leído lo deja leído y el contador baja', async () => {
    const { token } = await loginAs('ADMIN');
    const orden = await ordenCon(await base(), { status: 'DIAGNOSTICO', dias: 5 });

    const res = await request(app).post('/api/notifications/read').set(bearer(token)).send({ key: `ORDER:${orden.id}` });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ key: `ORDER:${orden.id}`, read: true, unread: 0 });
  });
});
