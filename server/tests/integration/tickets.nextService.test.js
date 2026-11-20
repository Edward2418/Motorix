import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createServiceType, createTicket } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioPago } from '../helpers/payments.js';
import { todayLocal } from '../../services/maintenanceService.js';

beforeEach(resetTables);
afterAll(closePool);

const generar = (token, orderId) => request(app).post(`/api/orders/${orderId}/ticket`).set(bearer(token));
const consultar = (token, orderId) => request(app).get(`/api/orders/${orderId}/ticket`).set(bearer(token));
const ligar = (orderId, tipo) =>
  pool.query('INSERT INTO order_services (order_id, description, cost, service_type_id) VALUES (?, ?, 100, ?)', [orderId, tipo.name, tipo.id]);
const kilometrajeDelServicio = (orderId, km) => pool.query('UPDATE service_orders SET service_mileage = ? WHERE id = ?', [km, orderId]);
const contenidoGuardado = async (orderId) => {
  const [[fila]] = await pool.query('SELECT content FROM tickets WHERE order_id = ?', [orderId]);
  return typeof fila.content === 'string' ? JSON.parse(fila.content) : fila.content;
};
const sumarDias = (texto, dias) => {
  const [a, m, d] = texto.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
};

describe('próximo servicio en el ticket nuevo', () => {
  test('trae la fecha y el kilometraje del tipo con intervalo ligado a la orden', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'TERMINADO', total: 800 });
    await kilometrajeDelServicio(orden.id, 42000);
    await ligar(orden.id, await createServiceType({ name: 'Cambio de aceite', intervalDays: 180, intervalKm: 5000 }));

    const res = await generar(tokens.recepcion, orden.id);

    expect(res.status).toBe(201);
    expect(res.body.data.nextService).toEqual({ dueDate: sumarDias(todayLocal(), 180), dueMileage: 47000 });
  });

  test('con varios tipos toma la fecha más cercana y el kilometraje más cercano', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'TERMINADO', total: 800 });
    await kilometrajeDelServicio(orden.id, 42000);
    await ligar(orden.id, await createServiceType({ name: 'Aceite', intervalDays: 180, intervalKm: 5000 }));
    await ligar(orden.id, await createServiceType({ name: 'Frenos', intervalDays: 90, intervalKm: 20000 }));
    await ligar(orden.id, await createServiceType({ name: 'Alineación', intervalDays: 365, intervalKm: 10000 }));

    const { nextService } = (await generar(tokens.recepcion, orden.id)).body.data;

    expect(nextService).toEqual({ dueDate: sumarDias(todayLocal(), 90), dueMileage: 47000 });
  });

  test('si ningún tipo tiene intervalo en días, la fecha queda nula (y al revés con los kilómetros)', async () => {
    const soloKm = await escenarioPago({ status: 'TERMINADO', total: 800 });
    await kilometrajeDelServicio(soloKm.orden.id, 10000);
    await ligar(soloKm.orden.id, await createServiceType({ name: 'Balanceo', intervalDays: null, intervalKm: 8000 }));
    expect((await generar(soloKm.tokens.recepcion, soloKm.orden.id)).body.data.nextService).toEqual({ dueDate: null, dueMileage: 18000 });
  });

  test('sin kilometraje del servicio usa el de entrada de la orden', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'TERMINADO', total: 800 });
    await ligar(orden.id, await createServiceType({ intervalDays: null, intervalKm: 5000 }));

    const { nextService } = (await generar(tokens.recepcion, orden.id)).body.data;

    expect(nextService.dueMileage).toBe(6000);
  });

  test('un tipo repetido en varias líneas cuenta una sola vez y uno desactivado sigue contando', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'TERMINADO', total: 800 });
    await kilometrajeDelServicio(orden.id, 1000);
    const tipo = await createServiceType({ intervalDays: 30, intervalKm: 1000, active: false });
    await ligar(orden.id, tipo);
    await ligar(orden.id, tipo);

    expect((await generar(tokens.recepcion, orden.id)).body.data.nextService).toEqual({ dueDate: sumarDias(todayLocal(), 30), dueMileage: 2000 });
  });

  test('se guarda en el contenido emitido y la consulta posterior lo devuelve igual', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'TERMINADO', total: 800 });
    await ligar(orden.id, await createServiceType());
    const emitido = (await generar(tokens.recepcion, orden.id)).body.data;

    expect((await contenidoGuardado(orden.id)).nextService).toEqual(emitido.nextService);
    expect((await consultar(tokens.admin, orden.id)).body.data.nextService).toEqual(emitido.nextService);
  });
});

describe('sin próximo servicio', () => {
  test('una orden sin tipos de servicio no trae nextService, ni en la respuesta ni en lo guardado', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'TERMINADO', total: 800 });

    const res = await generar(tokens.recepcion, orden.id);

    expect(res.status).toBe(201);
    expect(res.body.data).not.toHaveProperty('nextService');
    expect(await contenidoGuardado(orden.id)).not.toHaveProperty('nextService');
  });

  test('un ticket anterior al sprint (sin contenido guardado) se consulta sin errores y sin nextService', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'TERMINADO', total: 800 });
    await ligar(orden.id, await createServiceType());
    await createTicket({ orderId: orden.id, folio: 'TK-2026-0001', orderTotal: 900 });

    const res = await consultar(tokens.admin, orden.id);

    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('nextService');
  });
});

describe('un ticket emitido no cambia', () => {
  test('editar o desactivar después el tipo no cambia el próximo servicio ya emitido', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'TERMINADO', total: 800 });
    await kilometrajeDelServicio(orden.id, 20000);
    const tipo = await createServiceType({ intervalDays: 180, intervalKm: 5000 });
    await ligar(orden.id, tipo);
    const emitido = (await generar(tokens.recepcion, orden.id)).body.data;

    await request(app).put(`/api/service-types/${tipo.id}`).set(bearer(tokens.admin)).send({ name: 'Nuevo nombre', intervalDays: 30, intervalKm: 500 });
    await request(app).patch(`/api/service-types/${tipo.id}/status`).set(bearer(tokens.admin)).send({ active: false });

    const despues = (await consultar(tokens.admin, orden.id)).body.data;
    expect(despues.nextService).toEqual(emitido.nextService);
    expect(despues.nextService.dueMileage).toBe(25000);
  });

  test('pedir el ticket otra vez no lo vuelve a calcular', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'TERMINADO', total: 800 });
    const tipo = await createServiceType({ intervalDays: 180, intervalKm: 5000 });
    await ligar(orden.id, tipo);
    const primero = (await generar(tokens.recepcion, orden.id)).body.data;
    await pool.query('UPDATE service_types SET interval_km = 9999 WHERE id = ?', [tipo.id]);

    const segundo = await generar(tokens.recepcion, orden.id);

    expect(segundo.status).toBe(200);
    expect(segundo.body.data.nextService).toEqual(primero.nextService);
  });
});
