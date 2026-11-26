import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createOrder, createClient, createVehicle, createMechanic, addServiceLine, markFinished } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';
import { leerCsv, pedirCsv } from '../helpers/csv.js';

beforeEach(resetTables);
afterAll(closePool);

const OCTUBRE = 'from=2026-10-01&to=2026-10-31';
const pedir = (token) => request(app).get(`/api/reports/productivity?${OCTUBRE}`).set(bearer(token));

let placa = 0;
async function ordenTerminada(mecanicoId, finishedAt) {
  placa += 1;
  const client = await createClient({ name: `Cliente ${placa}` });
  const vehicle = await createVehicle({ clientId: client.id, licensePlate: `PRD${1000 + placa}` });
  const orden = await createOrder({ clientId: client.id, vehicleId: vehicle.id, mechanicId: mecanicoId, status: 'TERMINADO' });
  await markFinished({ orderId: orden.id, finishedAt });
  return orden;
}

const manoDeObra = (orderId, importe) => addServiceLine(orderId, 'Mano de obra', importe, 'order_labor');

async function escenario() {
  const ana = await createMechanic({ username: 'ana', name: 'Ana Ruiz' });
  const beto = await createMechanic({ username: 'beto', name: 'Beto Luna' });
  await createMechanic({ username: 'sin.ordenes', name: 'Sin Órdenes' });
  const una = await ordenTerminada(ana.id, new Date(2026, 9, 5, 10, 0));
  const dos = await ordenTerminada(ana.id, new Date(2026, 9, 6, 10, 0));
  const tres = await ordenTerminada(beto.id, new Date(2026, 9, 7, 10, 0));
  const fuera = await ordenTerminada(beto.id, new Date(2026, 8, 30, 23, 59, 59));
  await manoDeObra(una.id, '300.10');
  await manoDeObra(una.id, '100.20');
  await manoDeObra(dos.id, 200);
  await manoDeObra(tres.id, 1000);
  await manoDeObra(fuera.id, 999);
  return { ana, beto, una, token: (await loginAs('ADMIN')).token };
}

describe('productividad por mecánico', () => {
  test('cuenta las órdenes terminadas y la mano de obra del periodo por mecánico', async () => {
    const { ana, beto, token } = await escenario();

    const res = await pedir(token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [
        { mechanicId: ana.id, mechanicName: 'Ana Ruiz', finishedOrders: 2, laborTotal: 600.3 },
        { mechanicId: beto.id, mechanicName: 'Beto Luna', finishedOrders: 1, laborTotal: 1000 }
      ]
    });
  });

  test('una orden que pasa por TERMINADO más de una vez cuenta una sola vez', async () => {
    const { una, token } = await escenario();
    await markFinished({ orderId: una.id, finishedAt: new Date(2026, 9, 20, 10, 0) });

    const { data } = (await pedir(token)).body;

    expect(data[0]).toMatchObject({ finishedOrders: 2, laborTotal: 600.3 });
  });

  test('una orden terminada sin mano de obra cuenta con importe cero', async () => {
    const mecanico = await createMechanic({ username: 'solo', name: 'Solo' });
    await ordenTerminada(mecanico.id, new Date(2026, 9, 2, 10, 0));
    const { token } = await loginAs('ADMIN');

    expect((await pedir(token)).body.data).toEqual([{ mechanicId: mecanico.id, mechanicName: 'Solo', finishedOrders: 1, laborTotal: 0 }]);
  });

  test('sin órdenes terminadas devuelve una lista vacía', async () => {
    const { token } = await loginAs('ADMIN');
    expect((await pedir(token)).body).toEqual({ data: [] });
  });

  test('el CSV coincide con el JSON', async () => {
    const { token } = await escenario();

    const res = await pedirCsv(token, `/api/reports/productivity?${OCTUBRE}`);

    expect(res.headers['content-disposition']).toBe('attachment; filename="productividad-2026-10-01-a-2026-10-31.csv"');
    expect(leerCsv(res.body)).toEqual([
      ['Mecánico', 'Órdenes terminadas', 'Mano de obra'],
      ['Ana Ruiz', '2', '600.30'],
      ['Beto Luna', '1', '1000.00']
    ]);
  });

  test.each(['RECEPTIONIST', 'MECHANIC'])('el rol %s recibe 403', async (rol) => {
    const { token } = await loginAs(rol);
    expect((await pedir(token)).status).toBe(403);
  });
});
