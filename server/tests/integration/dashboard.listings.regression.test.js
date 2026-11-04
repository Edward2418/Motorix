import request from 'supertest';
import app from '../../app.js';
import {
  pool,
  resetTables,
  closePool,
  addServiceLine,
  createClient,
  createVehicle,
  createOrder,
  createPart,
  createOrderPart,
  createPayment
} from '../helpers/db.js';
import { bearer, loginAs } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';
import { runSeeds } from '../../scripts/sqlRunner.js';

afterAll(closePool);

const centavos = (importe) => Math.round(Number(importe) * 100);
const get = (token, ruta) => request(app).get(ruta).set(bearer(token));

// Total de la orden calculado directo en la base, en centavos enteros, sin pasar por la API.
async function totalEnLaBase(orderId) {
  const [[fila]] = await pool.query(
    `SELECT (SELECT COALESCE(SUM(cost), 0) FROM order_services WHERE order_id = ?) AS servicios,
            (SELECT COALESCE(SUM(amount), 0) FROM order_labor WHERE order_id = ?) AS mano_de_obra,
            (SELECT COALESCE(SUM(quantity * unit_price), 0) FROM order_parts WHERE order_id = ?) AS refacciones`,
    [orderId, orderId, orderId]
  );
  return centavos(fila.servicios) + centavos(fila.mano_de_obra) + centavos(fila.refacciones);
}

describe('panel y listados con órdenes que tienen refacciones (regresión del Sprint 5)', () => {
  let escenario;
  let ordenes;

  beforeEach(async () => {
    await resetTables();
    escenario = await escenarioOrden('TERMINADO');
    const { orden: primera, mecanico } = escenario;
    // A: servicio 850 + mano de obra 450 + refacción 3 × 33.33 → 1,399.99
    await addServiceLine(primera.id, 'Servicio', 850);
    await addServiceLine(primera.id, 'Mano de obra', 450, 'order_labor');
    const bujias = await createPart({ code: 'BUJ-01', stock: 20, salePrice: 33.33 });
    await createOrderPart({ orderId: primera.id, partId: bujias.id, quantity: 3 });

    const nuevaOrden = async (n, placa) => {
      const client = await createClient({ name: `Cliente ${n}`, phone: `55500000${n}0` });
      const vehicle = await createVehicle({ clientId: client.id, licensePlate: placa });
      return createOrder({ clientId: client.id, vehicleId: vehicle.id, mechanicId: mecanico.id, status: 'TERMINADO' });
    };
    // B: importes que suelen dar errores de coma flotante: 0.10 + 0.20 + 3 × 0.07 → 0.51
    const segunda = await nuevaOrden(1, 'BBB1111');
    await addServiceLine(segunda.id, 'Servicio', 0.1);
    await addServiceLine(segunda.id, 'Mano de obra', 0.2, 'order_labor');
    const tornillos = await createPart({ code: 'TOR-01', stock: 50, salePrice: 0.07 });
    await createOrderPart({ orderId: segunda.id, partId: tornillos.id, quantity: 3 });
    // C: solo refacciones, 5 × 19.99 → 99.95, cobrada por completo
    const tercera = await nuevaOrden(2, 'CCC2222');
    const filtros = await createPart({ code: 'FIL-01', stock: 30, salePrice: 19.99 });
    await createOrderPart({ orderId: tercera.id, partId: filtros.id, quantity: 5 });

    await createPayment({ orderId: primera.id, amount: 400, method: 'EFECTIVO' });
    await createPayment({ orderId: tercera.id, amount: 99.95, method: 'TRANSFERENCIA' });
    ordenes = { primera, segunda, tercera };
  });

  test('el total de cada orden en el listado, el detalle y el resumen de pagos coincide con la suma de sus líneas en la base', async () => {
    const { admin, recepcion } = escenario.tokens;
    const lista = await get(admin, '/api/orders');
    expect(lista.status).toBe(200);

    for (const orden of Object.values(ordenes)) {
      const esperado = await totalEnLaBase(orden.id);
      const enListado = lista.body.data.find((item) => item.id === orden.id);
      const detalle = await get(recepcion, `/api/orders/${orden.id}`);
      const pagos = await get(recepcion, `/api/orders/${orden.id}/payments`);
      expect({ folio: orden.folio, listado: centavos(enListado.total) }).toEqual({ folio: orden.folio, listado: esperado });
      expect({ folio: orden.folio, detalle: centavos(detalle.body.data.total) }).toEqual({ folio: orden.folio, detalle: esperado });
      expect({ folio: orden.folio, resumen: centavos(pagos.body.data.summary.total) }).toEqual({ folio: orden.folio, resumen: esperado });
    }
    expect(centavos((await get(admin, `/api/orders/${ordenes.primera.id}`)).body.data.total)).toBe(139999);
    expect(centavos((await get(admin, `/api/orders/${ordenes.segunda.id}`)).body.data.total)).toBe(51);
    expect(centavos((await get(admin, `/api/orders/${ordenes.tercera.id}`)).body.data.total)).toBe(9995);
  });

  test('las cifras de importe del panel (saldo pendiente y cobrado) coinciden con las de las órdenes y los pagos', async () => {
    const { admin, recepcion } = escenario.tokens;
    const panel = await get(admin, '/api/dashboard');
    expect(panel.status).toBe(200);

    // Cobrado del periodo: 400 + 99.95
    expect(centavos(panel.body.data.indicators.collected)).toBe(49995);

    // Saldo pendiente: A (1,399.99 − 400) y B (0.51); C está pagada por completo y no aparece.
    const saldo = panel.body.data.attention.pendingBalance;
    expect(saldo.count).toBe(2);
    expect(centavos(saldo.total)).toBe(99999 + 51);
    for (const item of saldo.items) {
      const detalle = await get(recepcion, `/api/orders/${item.id}`);
      expect({ folio: item.folio, total: centavos(item.total), saldo: centavos(item.balance) }).toEqual({
        folio: item.folio,
        total: centavos(detalle.body.data.total),
        saldo: centavos(detalle.body.data.payment.balance)
      });
    }
    expect(saldo.items.map((item) => item.folio)).not.toContain(ordenes.tercera.folio);
  });

  test('los listados de órdenes y de pagos no fallan con órdenes que tienen refacciones y se pueden filtrar y paginar', async () => {
    const { admin, recepcion } = escenario.tokens;
    for (const ruta of ['/api/orders?status=TERMINADO', '/api/orders?page=1&pageSize=2', '/api/orders?search=BBB1111']) {
      const res = await get(admin, ruta);
      expect({ ruta, status: res.status }).toEqual({ ruta, status: 200 });
    }
    for (const orden of Object.values(ordenes)) {
      expect((await get(recepcion, `/api/orders/${orden.id}/payments`)).status).toBe(200);
    }
  });

  test('con los datos de ejemplo cargados el panel muestra la orden cobrable con refacciones del Sprint 5 y su saldo', async () => {
    await resetTables();
    await runSeeds(pool, () => {});
    const { token } = await loginAs('ADMIN', { username: 'admin.pruebas' });
    const panel = await get(token, '/api/dashboard');
    expect(panel.status).toBe(200);
    const saldos = panel.body.data.attention.pendingBalance;
    const elDeEjemplo = saldos.items.find((item) => item.folio === 'OS-2026-0009');
    expect(elDeEjemplo).toBeDefined();
    expect(centavos(elDeEjemplo.total)).toBe(260000);
    expect(centavos(elDeEjemplo.balance)).toBe(260000);
  });
});
