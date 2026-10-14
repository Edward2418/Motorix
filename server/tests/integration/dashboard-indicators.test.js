import request from 'supertest';
import app from '../../app.js';
import {
  resetTables,
  closePool,
  createClient,
  createVehicle,
  createMechanic,
  createOrder,
  createPart,
  createPayment
} from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

describe('indicadores del panel', () => {
  let token;
  let mecanico;
  let contador = 0;

  beforeEach(async () => {
    await resetTables();
    contador = 0;
    token = (await loginAs('ADMIN')).token;
    mecanico = await createMechanic();
  });
  afterAll(closePool);

  const panel = async (period) => {
    const res = await request(app).get('/api/dashboard').query(period ? { period } : {}).set(bearer(token));
    expect(res.status).toBe(200);
    return res.body.data;
  };

  async function orden(status) {
    contador += 1;
    const client = await createClient({ name: `Cliente ${contador}`, phone: `55100000${String(contador).padStart(2, '0')}` });
    const vehicle = await createVehicle({ clientId: client.id, licensePlate: `PAN${String(contador).padStart(4, '0')}` });
    return createOrder({ clientId: client.id, vehicleId: vehicle.id, mechanicId: mecanico.id, status });
  }

  test('sin datos todas las cifras son cero y están las siete entradas por estado', async () => {
    const data = await panel();
    expect(data.indicators).toEqual({ vehiclesInRepair: 0, openOrders: 0, collected: 0, lowStockParts: 0 });
    expect(data.ordersByStatus).toHaveLength(7);
    expect(data.ordersByStatus.every((e) => e.count === 0)).toBe(true);
  });

  test('vehiclesInRepair cuenta las órdenes EN_REPARACION y openOrders las abiertas', async () => {
    for (const status of ['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'EN_REPARACION', 'ESPERANDO_REFACCION', 'TERMINADO', 'ENTREGADO', 'CANCELADA']) {
      await orden(status);
    }
    const data = await panel();
    expect(data.indicators.vehiclesInRepair).toBe(2);
    // Abiertas: todas menos ENTREGADO y CANCELADA (incluida TERMINADO).
    expect(data.indicators.openOrders).toBe(6);
  });

  test('ordersByStatus coincide con el conteo por estado del listado de órdenes y suma el total', async () => {
    for (const status of ['RECIBIDO', 'RECIBIDO', 'DIAGNOSTICO', 'TERMINADO', 'ENTREGADO', 'ENTREGADO', 'ENTREGADO']) {
      await orden(status);
    }
    const data = await panel();
    for (const { status, count } of data.ordersByStatus) {
      const lista = await request(app).get('/api/orders').query({ status, pageSize: 1 }).set(bearer(token));
      expect({ status, count }).toEqual({ status, count: lista.body.meta.total });
    }
    expect(data.ordersByStatus.reduce((suma, e) => suma + e.count, 0)).toBe(7);
  });

  test('collected suma solo los pagos PAGADO con paid_at dentro del periodo', async () => {
    const o = await orden('ENTREGADO');
    const hoy = new Date();
    const haceTresDias = new Date(hoy.getTime() - 3 * 86400000);
    const haceTresMeses = new Date(hoy.getFullYear(), hoy.getMonth() - 3, 15, 10, 0, 0);
    await createPayment({ orderId: o.id, amount: 100, paidAt: hoy });
    await createPayment({ orderId: o.id, amount: 200, paidAt: hoy, method: 'TARJETA' });
    await createPayment({ orderId: o.id, amount: 400, paidAt: haceTresMeses });
    await createPayment({ orderId: o.id, amount: 800, status: 'PENDIENTE', method: 'MERCADO_PAGO' });
    await createPayment({ orderId: o.id, amount: 1600, status: 'RECHAZADO', method: 'MERCADO_PAGO' });
    await createPayment({ orderId: o.id, amount: 3200, status: 'CANCELADO' });
    // Un pago de hace tres días cae en la semana y en el mes (si el mes lleva al menos tres días), no en hoy.
    await createPayment({ orderId: o.id, amount: 50, paidAt: haceTresDias });

    expect((await panel('today')).indicators.collected).toBe(300);
    expect((await panel('week')).indicators.collected).toBe(350);
    const enMes = (await panel('month')).indicators.collected;
    expect(enMes).toBe(hoy.getDate() > 3 ? 350 : 300);
  });

  test('el periodo por defecto es month', async () => {
    const data = await panel();
    expect(data.period.key).toBe('month');
    const explicito = await panel('month');
    expect(explicito.period).toEqual(data.period);
  });

  test('lowStockParts coincide con las alertas del inventario', async () => {
    await createPart({ code: 'A-1', stock: 0, minStock: 3 });
    await createPart({ code: 'A-2', stock: 2, minStock: 3 });
    await createPart({ code: 'A-3', stock: 10, minStock: 3 });
    await createPart({ code: 'A-4', stock: 0, minStock: 3, active: false });
    const data = await panel();
    const alertas = await request(app).get('/api/parts/alerts').set(bearer(token));
    expect(data.indicators.lowStockParts).toBe(alertas.body.data.length);
    expect(data.indicators.lowStockParts).toBe(2);
  });

  test('cada orden se cuenta una sola vez aunque tenga varios pagos', async () => {
    const o = await orden('TERMINADO');
    await createPayment({ orderId: o.id, amount: 10 });
    await createPayment({ orderId: o.id, amount: 20 });
    const data = await panel();
    expect(data.indicators.openOrders).toBe(1);
    expect(data.ordersByStatus.find((e) => e.status === 'TERMINADO').count).toBe(1);
    expect(data.indicators.collected).toBe(30);
  });

  test('las fechas del periodo se devuelven en ISO y cubren hoy', async () => {
    const data = await panel('today');
    const ahora = Date.now();
    expect(new Date(data.period.from).getTime()).toBeLessThanOrEqual(ahora);
    expect(new Date(data.period.to).getTime()).toBeGreaterThanOrEqual(ahora);
  });
});
