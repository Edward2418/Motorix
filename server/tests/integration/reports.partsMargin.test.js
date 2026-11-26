import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createPart, createOrderPart, markFinished, createOrder, createClient, createVehicle, pool } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';
import { leerCsv, pedirCsv } from '../helpers/csv.js';

beforeEach(resetTables);
afterAll(closePool);

const OCTUBRE = 'from=2026-10-01&to=2026-10-31';
const pedir = (token, extra = '') => request(app).get(`/api/reports/parts-margin?${OCTUBRE}${extra}`).set(bearer(token));

async function escenario() {
  const { orden, mecanico, tokens } = await escenarioOrden('TERMINADO');
  await markFinished({ orderId: orden.id, finishedAt: new Date(2026, 9, 5, 10, 0) });
  const bujia = await createPart({ code: 'BUJ', name: 'Bujía', purchasePrice: 100, salePrice: 150 });
  const filtro = await createPart({ code: 'FIL', name: 'Filtro', purchasePrice: 0, salePrice: '80.50' });
  await createOrderPart({ orderId: orden.id, partId: bujia.id, quantity: 2 });
  await createOrderPart({ orderId: orden.id, partId: filtro.id, quantity: 1 });
  return { orden, mecanico, bujia, filtro, tokens };
}

describe('margen de refacciones', () => {
  test('muestra venta, compra y margen, marca «sin costo» y suma totales coherentes', async () => {
    const { bujia, filtro, tokens } = await escenario();

    const res = await pedir(tokens.admin);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([
      { partId: bujia.id, code: 'BUJ', name: 'Bujía', quantity: 2, salePrice: 150, purchasePrice: 100, marginPerUnit: 50, salesTotal: 300, costTotal: 200, marginTotal: 100, withoutCost: false },
      { partId: filtro.id, code: 'FIL', name: 'Filtro', quantity: 1, salePrice: 80.5, purchasePrice: null, marginPerUnit: null, salesTotal: 80.5, costTotal: null, marginTotal: null, withoutCost: true }
    ]);
    expect(res.body.data.totals).toEqual({ salesTotal: 380.5, costTotal: 200, marginTotal: 100, withoutCostCount: 1 });
    expect(res.body.meta).toEqual({ page: 1, pageSize: 50, total: 2 });
  });

  test('usa el precio de venta de cada línea y el precio de compra vigente, y separa precios de venta distintos', async () => {
    const { mecanico, bujia, tokens } = await escenario();
    await pool.query('UPDATE parts SET sale_price = 180, purchase_price = 120 WHERE id = ?', [bujia.id]);
    const client = await createClient({ name: 'Otra' });
    const vehicle = await createVehicle({ clientId: client.id, licensePlate: 'XYZ9876' });
    const otra = await createOrder({ clientId: client.id, vehicleId: vehicle.id, mechanicId: mecanico.id, status: 'TERMINADO' });
    await markFinished({ orderId: otra.id, finishedAt: new Date(2026, 9, 8, 10, 0) });
    await createOrderPart({ orderId: otra.id, partId: bujia.id, quantity: 1 });

    const filas = (await pedir(tokens.admin)).body.data.items.filter((f) => f.code === 'BUJ');

    expect(filas.map((f) => [f.salePrice, f.purchasePrice, f.quantity, f.marginTotal])).toEqual([
      [150, 120, 2, 60],
      [180, 120, 1, 60]
    ]);
  });

  test('no cuenta las órdenes terminadas fuera del rango', async () => {
    const { orden, tokens } = await escenario();
    await pool.query("UPDATE order_status_history SET changed_at = '2026-09-15 10:00:00' WHERE order_id = ?", [orden.id]);

    const { data } = (await pedir(tokens.admin)).body;

    expect(data).toEqual({ items: [], totals: { salesTotal: 0, costTotal: 0, marginTotal: 0, withoutCostCount: 0 } });
  });

  test('los totales cubren todo el rango aunque se pida una sola fila por página', async () => {
    const { tokens } = await escenario();

    const res = await pedir(tokens.admin, '&pageSize=1&page=2');

    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.totals.salesTotal).toBe(380.5);
    expect(res.body.meta).toEqual({ page: 2, pageSize: 1, total: 2 });
  });

  test('el CSV coincide con el JSON, con su fila de totales', async () => {
    const { tokens } = await escenario();

    const res = await pedirCsv(tokens.admin, `/api/reports/parts-margin?${OCTUBRE}`);

    expect(res.headers['content-disposition']).toBe('attachment; filename="margen-refacciones-2026-10-01-a-2026-10-31.csv"');
    expect(leerCsv(res.body)).toEqual([
      ['Código', 'Refacción', 'Piezas', 'Precio de venta', 'Precio de compra', 'Margen por pieza', 'Venta total', 'Costo total', 'Margen total', 'Observación'],
      ['BUJ', 'Bujía', '2', '150.00', '100.00', '50.00', '300.00', '200.00', '100.00', ''],
      ['FIL', 'Filtro', '1', '80.50', '', '', '80.50', '', '', 'Sin costo'],
      ['Total', '', '3', '', '', '', '380.50', '200.00', '100.00', 'Sin costo: 1']
    ]);
  });

  test.each(['RECEPTIONIST', 'MECHANIC'])('el rol %s recibe 403 y no ve precios de compra', async (rol) => {
    const { tokens } = await escenario();

    const res = await pedir(rol === 'MECHANIC' ? tokens.mecanico : tokens.recepcion);

    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toMatch(/purchasePrice|costTotal/);
  });
});
