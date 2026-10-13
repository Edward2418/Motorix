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
  createOrderPart,
  addServiceLine,
  markFinished
} from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';

async function escenario() {
  const mecanico = await createMechanic({ username: 'mecanico.hist', name: 'Mecánico Historial' });
  const client = await createClient({ name: 'Ana Pérez' });
  const vehicle = await createVehicle({ clientId: client.id, licensePlate: 'HIS0001' });
  const nueva = (status, extra = {}) =>
    createOrder({ clientId: client.id, vehicleId: vehicle.id, mechanicId: mecanico.id, status, ...extra });
  return { mecanico, client, vehicle, nueva };
}

const historial = (token, vehicleId, query = '') => request(app).get(`/api/vehicles/${vehicleId}/history${query}`).set(bearer(token));

describe('historial del vehículo', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('solo muestra las órdenes TERMINADO y ENTREGADO, la más reciente primero', async () => {
    const { vehicle, nueva } = await escenario();
    const antigua = await nueva('ENTREGADO');
    const media = await nueva('ENTREGADO');
    const reciente = await nueva('TERMINADO');
    const cancelada = await nueva('CANCELADA');
    await markFinished({ orderId: antigua.id, finishedAt: '2026-06-01 09:00:00' });
    await markFinished({ orderId: media.id, finishedAt: '2026-08-15 09:00:00' });
    await markFinished({ orderId: reciente.id, finishedAt: '2026-09-20 09:00:00' });
    const { token } = await loginAs('RECEPTIONIST');

    const res = await historial(token, vehicle.id);
    expect(res.status).toBe(200);
    expect(res.body.data.map((e) => e.folio)).toEqual([reciente.folio, media.folio, antigua.folio]);
    expect(res.body.data.map((e) => e.folio)).not.toContain(cancelada.folio);
    expect(res.body.meta.total).toBe(3);
  });

  test('una orden abierta no aparece en el historial', async () => {
    const { vehicle, nueva } = await escenario();
    const entregada = await nueva('ENTREGADO');
    await markFinished({ orderId: entregada.id, finishedAt: '2026-07-01 09:00:00' });
    const abierta = await nueva('EN_REPARACION');
    const { token } = await loginAs('ADMIN');

    const res = await historial(token, vehicle.id);
    expect(res.body.data.map((e) => e.folio)).toEqual([entregada.folio]);
    expect(res.body.data.map((e) => e.folio)).not.toContain(abierta.folio);
  });

  test('con la misma fecha de servicio se ordena por identificador descendente', async () => {
    const { vehicle, nueva } = await escenario();
    const primera = await nueva('ENTREGADO');
    const segunda = await nueva('ENTREGADO');
    await markFinished({ orderId: primera.id, finishedAt: '2026-08-01 12:00:00' });
    await markFinished({ orderId: segunda.id, finishedAt: '2026-08-01 12:00:00' });
    const { token } = await loginAs('ADMIN');

    const res = await historial(token, vehicle.id);
    expect(res.body.data.map((e) => e.folio)).toEqual([segunda.folio, primera.folio]);
  });

  test('incluye servicios, mano de obra y refacciones con el total correcto', async () => {
    const { vehicle, nueva, mecanico } = await escenario();
    const orden = await nueva('ENTREGADO');
    await markFinished({ orderId: orden.id, finishedAt: '2026-08-01 12:00:00', serviceMileage: 5200 });
    await addServiceLine(orden.id, 'Afinación', 1000.5);
    await addServiceLine(orden.id, 'Balanceo', 300);
    await addServiceLine(orden.id, 'Mano de obra de afinación', 400.25, 'order_labor');
    const bujia = await createPart({ code: 'BUJ-01', name: 'Bujía', stock: 20, salePrice: 100 });
    await createOrderPart({ orderId: orden.id, partId: bujia.id, quantity: 4, createdBy: mecanico.id });
    const { token } = await loginAs('MECHANIC', { username: 'otro.mecanico' });

    const [entrada] = (await historial(token, vehicle.id)).body.data;
    expect(entrada.services.map((s) => s.description)).toEqual(['Afinación', 'Balanceo']);
    expect(entrada.labor).toEqual([{ description: 'Mano de obra de afinación', amount: 400.25 }]);
    expect(entrada.parts).toEqual([{ partId: bujia.id, code: 'BUJ-01', name: 'Bujía', quantity: 4, unitPrice: 100 }]);
    expect(entrada.total).toBe(2100.75);
    expect(entrada.serviceMileage).toBe(5200);
    expect(entrada.mechanicName).toBe('Mecánico Historial');
  });

  test('una orden sin servicios aparece con listas vacías y total cero', async () => {
    const { vehicle, nueva } = await escenario();
    const orden = await nueva('TERMINADO');
    await markFinished({ orderId: orden.id, finishedAt: '2026-08-01 12:00:00' });
    const { token } = await loginAs('ADMIN');

    const [entrada] = (await historial(token, vehicle.id)).body.data;
    expect(entrada).toMatchObject({ services: [], labor: [], parts: [], total: 0 });
  });

  test('un vehículo sin servicios finalizados devuelve una lista vacía', async () => {
    const { vehicle } = await escenario();
    const { token } = await loginAs('ADMIN');

    const res = await historial(token, vehicle.id);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  test('pagina el historial', async () => {
    const { vehicle, nueva } = await escenario();
    for (let dia = 1; dia <= 3; dia += 1) {
      const orden = await nueva('ENTREGADO');
      await markFinished({ orderId: orden.id, finishedAt: `2026-08-0${dia} 12:00:00` });
    }
    const { token } = await loginAs('ADMIN');

    const primera = await historial(token, vehicle.id, '?pageSize=2&page=1');
    const segunda = await historial(token, vehicle.id, '?pageSize=2&page=2');
    expect(primera.body.data).toHaveLength(2);
    expect(segunda.body.data).toHaveLength(1);
    expect(primera.body.meta).toEqual({ page: 1, pageSize: 2, total: 3 });
  });

  test('un vehículo desactivado conserva su historial', async () => {
    const { vehicle, nueva } = await escenario();
    const orden = await nueva('ENTREGADO');
    await markFinished({ orderId: orden.id, finishedAt: '2026-08-01 12:00:00' });
    const admin = await loginAs('ADMIN');
    await request(app).patch(`/api/vehicles/${vehicle.id}/status`).set(bearer(admin.token)).send({ active: false });

    const res = await historial(admin.token, vehicle.id);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  test('sin kilometraje del servicio se usa el kilometraje de entrada', async () => {
    const { vehicle, nueva } = await escenario();
    const orden = await nueva('ENTREGADO', { entryMileage: 7777 });
    await markFinished({ orderId: orden.id, finishedAt: '2026-08-01 12:00:00' });
    const { token } = await loginAs('ADMIN');

    const [entrada] = (await historial(token, vehicle.id)).body.data;
    expect(entrada.serviceMileage).toBe(7777);
  });

  test('administración, recepción y cualquier mecánico (aunque la orden sea de otro) pueden consultarlo', async () => {
    const { vehicle, nueva } = await escenario();
    const orden = await nueva('ENTREGADO');
    await markFinished({ orderId: orden.id, finishedAt: '2026-08-01 12:00:00' });

    for (const rol of ['ADMIN', 'RECEPTIONIST', 'MECHANIC']) {
      const { token } = await loginAs(rol, { username: `consulta.${rol.toLowerCase()}` });
      const res = await historial(token, vehicle.id);
      expect({ rol, status: res.status, total: res.body.meta?.total }).toEqual({ rol, status: 200, total: 1 });
    }
  });

  test('una orden que pasa a TERMINADO por la API aparece en el historial sin captura adicional', async () => {
    const { orden, vehicle, tokens } = await escenarioOrden('EN_REPARACION');
    const antes = await historial(tokens.recepcion, vehicle.id);
    expect(antes.body.data).toEqual([]);

    const cambio = await request(app)
      .post(`/api/orders/${orden.id}/status`)
      .set(bearer(tokens.mecanico))
      .send({ status: 'TERMINADO', serviceMileage: 1500 });
    expect(cambio.status).toBe(200);

    const despues = await historial(tokens.recepcion, vehicle.id);
    expect(despues.body.data.map((e) => e.folio)).toEqual([orden.folio]);
    expect(despues.body.data[0].serviceMileage).toBeGreaterThanOrEqual(1000);
  });
});
