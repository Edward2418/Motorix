import request from 'supertest';
import app from '../../app.js';
import {
  resetTables,
  closePool,
  pool,
  createClient,
  createVehicle,
  createMechanic,
  createOrder,
  createAppointment,
  createMaintenance,
  createPart,
  createPayment,
  addServiceLine
} from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

const DIA = 86400000;

describe('listas de atención del panel', () => {
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

  const atencion = async (period) => {
    const res = await request(app).get('/api/dashboard').query(period ? { period } : {}).set(bearer(token));
    expect(res.status).toBe(200);
    return res.body.data.attention;
  };

  async function vehiculo() {
    contador += 1;
    const client = await createClient({ name: `Cliente ${contador}`, phone: `55200000${String(contador).padStart(2, '0')}` });
    const vehicle = await createVehicle({ clientId: client.id, licensePlate: `ATN${String(contador).padStart(4, '0')}` });
    return { client, vehicle };
  }

  async function orden(status, total = 0) {
    const { client, vehicle } = await vehiculo();
    const o = await createOrder({ clientId: client.id, vehicleId: vehicle.id, mechanicId: mecanico.id, status });
    if (total > 0) {
      await addServiceLine(o.id, 'Servicio', total);
    }
    return { ...o, client, vehicle };
  }

  test('las listas vacías devuelven arreglos vacíos y ceros', async () => {
    const a = await atencion();
    expect(a).toEqual({
      finishedOrders: { count: 0, items: [] },
      upcomingAppointments: { count: 0, items: [] },
      maintenance: { overdue: 0, soon: 0, items: [] },
      lowStockParts: { count: 0, items: [] },
      pendingBalance: { total: 0, count: 0, items: [] }
    });
  });

  test('finishedOrders cuenta cada orden una sola vez por su primer paso a TERMINADO dentro del periodo', async () => {
    const reciente = await orden('TERMINADO', 100);
    const entregada = await orden('ENTREGADO', 100);
    // La entregada también pasó por TERMINADO ayer: sigue contando una sola vez (aunque ya esté ENTREGADO).
    await pool.query(
      "INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, changed_at) VALUES (?, 'EN_REPARACION', 'TERMINADO', ?, ?), (?, 'TERMINADO', 'TERMINADO', ?, ?)",
      [entregada.id, mecanico.id, new Date(Date.now() - DIA), entregada.id, mecanico.id, new Date(Date.now() - DIA / 2)]
    );
    const vieja = await orden('ENTREGADO', 100);
    await pool.query(
      "INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, changed_at) VALUES (?, 'EN_REPARACION', 'TERMINADO', ?, ?)",
      [vieja.id, mecanico.id, new Date(Date.now() - 90 * DIA)]
    );

    const hoy = await atencion('today');
    expect(hoy.finishedOrders.count).toBe(1);
    expect(hoy.finishedOrders.items.map((i) => i.id)).toEqual([reciente.id]);

    const semana = await atencion('week');
    expect(semana.finishedOrders.count).toBe(2);
    expect(semana.finishedOrders.items.map((i) => i.id).sort()).toEqual([entregada.id, reciente.id].sort());
    expect(semana.finishedOrders.items[0]).toMatchObject({
      folio: expect.stringMatching(/^OS-/),
      clientName: expect.any(String),
      vehicleLabel: expect.any(String),
      status: expect.any(String),
      total: 100,
      balance: 100,
      finishedAt: expect.any(String)
    });
  });

  test('upcomingAppointments incluye PENDIENTE y CONFIRMADA de los próximos 7 días, en orden de fecha', async () => {
    const { client, vehicle } = await vehiculo();
    const crear = (dias, status) =>
      createAppointment({ clientId: client.id, vehicleId: vehicle.id, scheduledAt: new Date(Date.now() + dias * DIA), status });
    const tercera = await crear(3, 'PENDIENTE');
    const primera = await crear(1, 'CONFIRMADA');
    await crear(2, 'CANCELADA');
    await crear(2.5, 'COMPLETADA');
    await crear(9, 'PENDIENTE');
    await crear(-1, 'PENDIENTE');
    const a = await atencion();
    expect(a.upcomingAppointments.count).toBe(2);
    expect(a.upcomingAppointments.items.map((i) => i.id)).toEqual([primera.id, tercera.id]);
    expect(a.upcomingAppointments.items[0]).toMatchObject({
      scheduledAt: expect.any(String),
      clientName: expect.any(String),
      vehicleLabel: expect.any(String),
      status: 'CONFIRMADA'
    });
  });

  test('maintenance coincide con el listado de mantenimientos y trae primero los vencidos', async () => {
    const o = await orden('ENTREGADO');
    const dias = (n) => new Date(Date.now() + n * DIA).toISOString().slice(0, 10);
    const vencido = await createMaintenance({ vehicleId: o.vehicle.id, orderId: o.id, description: 'Aceite', dueDate: dias(-5) });
    const proximo = await createMaintenance({ vehicleId: o.vehicle.id, orderId: o.id, description: 'Frenos', dueDate: dias(10) });
    await createMaintenance({ vehicleId: o.vehicle.id, orderId: o.id, description: 'Llantas', dueDate: dias(200) });
    const a = await atencion();
    expect(a.maintenance.overdue).toBe(1);
    expect(a.maintenance.soon).toBe(1);
    expect(a.maintenance.items.map((i) => i.id)).toEqual([vencido.id, proximo.id]);
    expect(a.maintenance.items[0]).toMatchObject({ visualStatus: 'VENCIDO', description: 'Aceite', vehicleLabel: expect.any(String) });

    for (const [visualStatus, cuenta] of [['VENCIDO', a.maintenance.overdue], ['PROXIMO', a.maintenance.soon]]) {
      const lista = await request(app).get('/api/maintenance').query({ visualStatus }).set(bearer(token));
      expect(lista.body.meta.total).toBe(cuenta);
    }
  });

  test('lowStockParts coincide con las alertas y trae primero las agotadas', async () => {
    await createPart({ code: 'B-1', name: 'Baja', stock: 2, minStock: 3 });
    await createPart({ code: 'B-2', name: 'Agotada', stock: 0, minStock: 3 });
    await createPart({ code: 'B-3', name: 'Normal', stock: 9, minStock: 3 });
    const a = await atencion();
    expect(a.lowStockParts.count).toBe(2);
    expect(a.lowStockParts.items.map((i) => [i.code, i.stockLevel])).toEqual([['B-2', 'AGOTADO'], ['B-1', 'BAJO']]);
    expect(a.lowStockParts.items[0]).toMatchObject({ id: expect.any(Number), name: 'Agotada', stock: 0, minStock: 3 });
  });

  test('lowStockParts limita la lista a cinco y conserva el conteo total', async () => {
    for (let i = 0; i < 7; i += 1) {
      await createPart({ code: `C-${i}`, name: `Pieza ${i}`, stock: 1, minStock: 3 });
    }
    const a = await atencion();
    expect(a.lowStockParts.count).toBe(7);
    expect(a.lowStockParts.items).toHaveLength(5);
  });

  test('pendingBalance suma las órdenes terminadas o entregadas con saldo y lista las cinco de mayor saldo', async () => {
    const montos = [100, 900, 300, 700, 500, 200, 800];
    const ordenes = [];
    for (const monto of montos) {
      ordenes.push(await orden('TERMINADO', monto));
    }
    // Una pagada por completo, una abierta y una cancelada no aparecen.
    const pagada = await orden('ENTREGADO', 400);
    await createPayment({ orderId: pagada.id, amount: 400 });
    await orden('EN_REPARACION', 999);
    await orden('CANCELADA', 999);
    // Un pago parcial reduce el saldo; uno pendiente de Mercado Pago no lo reduce.
    await createPayment({ orderId: ordenes[1].id, amount: 250 });
    await createPayment({ orderId: ordenes[1].id, amount: 100, status: 'PENDIENTE', method: 'MERCADO_PAGO' });

    const a = await atencion();
    const esperados = [100, 650, 300, 700, 500, 200, 800];
    expect(a.pendingBalance.count).toBe(7);
    expect(a.pendingBalance.total).toBe(esperados.reduce((s, n) => s + n, 0));
    expect(a.pendingBalance.items.map((i) => i.balance)).toEqual([800, 700, 650, 500, 300]);
    expect(a.pendingBalance.items[0]).toMatchObject({ folio: expect.stringMatching(/^OS-/), total: 800, balance: 800 });
  });

  test('el saldo por cobrar coincide con el resumen de pagos de la orden', async () => {
    const o = await orden('TERMINADO', 1000);
    await createPayment({ orderId: o.id, amount: 350 });
    const a = await atencion();
    const detalle = await request(app).get(`/api/orders/${o.id}`).set(bearer(token));
    expect(a.pendingBalance.items[0].balance).toBe(detalle.body.data.payment.balance);
    expect(a.pendingBalance.items[0].total).toBe(detalle.body.data.total);
  });
});
