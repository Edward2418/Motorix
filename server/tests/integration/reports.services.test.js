import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createOrder, createClient, createVehicle, createServiceType, addServiceLine, markFinished, pool } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';
import { leerCsv, pedirCsv } from '../helpers/csv.js';

beforeEach(resetTables);
afterAll(closePool);

const OCTUBRE = 'from=2026-10-01&to=2026-10-31';
const pedir = (token, extra = '') => request(app).get(`/api/reports/services?${OCTUBRE}${extra}`).set(bearer(token));

// Tres órdenes: dos terminadas en octubre y una fuera del rango.
async function conOrdenes() {
  const { orden, mecanico, tokens } = await escenarioOrden('TERMINADO');
  const otra = async (placa) => {
    const client = await createClient({ name: `Cliente ${placa}` });
    const vehicle = await createVehicle({ clientId: client.id, licensePlate: placa });
    return createOrder({ clientId: client.id, vehicleId: vehicle.id, mechanicId: mecanico.id, status: 'TERMINADO' });
  };
  const segunda = await otra('DEF5678');
  const fuera = await otra('GHI9012');
  await markFinished({ orderId: orden.id, finishedAt: new Date(2026, 9, 5, 10, 0) });
  await markFinished({ orderId: segunda.id, finishedAt: new Date(2026, 9, 31, 23, 59, 0) });
  await markFinished({ orderId: fuera.id, finishedAt: new Date(2026, 10, 1, 0, 0, 0) });
  return { orden, segunda, fuera, token: tokens.admin };
}

const lineaConTipo = async (orderId, descripcion, costo, tipoId) => {
  await addServiceLine(orderId, descripcion, costo);
  await pool.query('UPDATE order_services SET service_type_id = ? WHERE order_id = ? AND description = ?', [tipoId, orderId, descripcion]);
};

describe('servicios más frecuentes', () => {
  test('agrupa por tipo de servicio y, sin tipo, por descripción, del más al menos frecuente', async () => {
    const { orden, segunda, token } = await conOrdenes();
    const aceite = await createServiceType({ name: 'Cambio de aceite' });
    await lineaConTipo(orden.id, 'Aceite sintético', '350.10', aceite.id);
    await lineaConTipo(segunda.id, 'Aceite mineral', '250.20', aceite.id);
    await addServiceLine(orden.id, 'Alineación', 400);

    const res = await pedir(token);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { serviceTypeId: aceite.id, name: 'Cambio de aceite', count: 2, total: 600.3 },
      { serviceTypeId: null, name: 'Alineación', count: 1, total: 400 }
    ]);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 50, total: 2 });
  });

  test('solo cuenta las órdenes cuyo primer paso a TERMINADO cae en el rango', async () => {
    const { orden, fuera, token } = await conOrdenes();
    await addServiceLine(orden.id, 'Afinación', 500);
    await addServiceLine(fuera.id, 'Frenos', 900);
    // Volvió a pasar por TERMINADO en noviembre: cuenta por su primer paso (octubre), una sola vez.
    await markFinished({ orderId: orden.id, finishedAt: new Date(2026, 10, 3, 9, 0) });

    const res = await pedir(token);

    expect(res.body.data).toEqual([{ serviceTypeId: null, name: 'Afinación', count: 1, total: 500 }]);
  });

  test('pagina con page y pageSize, y rechaza más de 200 por página', async () => {
    const { orden, token } = await conOrdenes();
    for (const nombre of ['A', 'B', 'C']) {
      await addServiceLine(orden.id, `Servicio ${nombre}`, 100);
    }

    const segunda = await pedir(token, '&page=2&pageSize=2');

    expect(segunda.body.data.map((f) => f.name)).toEqual(['Servicio C']);
    expect(segunda.body.meta).toEqual({ page: 2, pageSize: 2, total: 3 });
    expect((await pedir(token, '&pageSize=200')).status).toBe(200);
    expect((await pedir(token, '&pageSize=201')).status).toBe(400);
  });

  test('sin órdenes terminadas devuelve una lista vacía', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await pedir(token);
    expect(res.body).toEqual({ data: [], meta: { page: 1, pageSize: 50, total: 0 } });
  });

  test('el CSV coincide con el JSON y no se pagina', async () => {
    const { orden, token } = await conOrdenes();
    await addServiceLine(orden.id, 'Frenos', '1200.50');
    await addServiceLine(orden.id, 'Lavado', 80);

    const res = await pedirCsv(token, `/api/reports/services?${OCTUBRE}&pageSize=1`);

    expect(res.headers['content-disposition']).toBe('attachment; filename="servicios-2026-10-01-a-2026-10-31.csv"');
    expect(leerCsv(res.body)).toEqual([
      ['Servicio', 'Cantidad', 'Importe'],
      ['Frenos', '1', '1200.50'],
      ['Lavado', '1', '80.00']
    ]);
  });

  test.each(['RECEPTIONIST', 'MECHANIC'])('el rol %s recibe 403', async (rol) => {
    const { token } = await loginAs(rol);
    expect((await pedir(token)).status).toBe(403);
  });
});
