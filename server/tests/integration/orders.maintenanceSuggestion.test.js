import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createServiceType } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';
import { todayLocal } from '../../services/maintenanceService.js';

beforeEach(resetTables);
afterAll(closePool);

const pedir = (token, orderId) => request(app).get(`/api/orders/${orderId}/maintenance-suggestion`).set(bearer(token));
const ligar = (orderId, tipo, descripcion = 'Servicio') =>
  pool.query('INSERT INTO order_services (order_id, description, cost, service_type_id) VALUES (?, ?, 100, ?)', [orderId, descripcion, tipo?.id ?? null]);
const kilometrajeDelVehiculo = (id, km) => pool.query('UPDATE vehicles SET current_mileage = ? WHERE id = ?', [km, id]);

const sumarDias = (texto, dias) => {
  const [a, m, d] = texto.split('-').map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d + dias));
  return fecha.toISOString().slice(0, 10);
};

describe('GET /api/orders/:id/maintenance-suggestion', () => {
  test('devuelve una propuesta por tipo con intervalo ligado a las líneas de la orden', async () => {
    const { orden, vehicle, tokens } = await escenarioOrden();
    await kilometrajeDelVehiculo(vehicle.id, 42000);
    const aceite = await createServiceType({ name: 'Cambio de aceite', intervalDays: 180, intervalKm: 5000 });
    const frenos = await createServiceType({ name: 'Frenos', intervalDays: null, intervalKm: 20000 });
    await ligar(orden.id, aceite);
    await ligar(orden.id, frenos);

    const res = await pedir(tokens.admin, orden.id);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const sugerenciaAceite = res.body.data.find((s) => s.serviceTypeId === aceite.id);
    expect(sugerenciaAceite).toEqual({
      serviceTypeId: aceite.id,
      serviceTypeName: 'Cambio de aceite',
      description: 'Cambio de aceite',
      dueDate: sumarDias(todayLocal(), 180),
      dueMileage: 47000
    });
    expect(res.body.data.find((s) => s.serviceTypeId === frenos.id)).toMatchObject({ dueDate: null, dueMileage: 62000 });
  });

  test('un tipo repetido en varias líneas produce una sola propuesta', async () => {
    const { orden, tokens } = await escenarioOrden();
    const aceite = await createServiceType();
    await ligar(orden.id, aceite);
    await ligar(orden.id, aceite, 'Otro servicio');
    expect((await pedir(tokens.admin, orden.id)).body.data).toHaveLength(1);
  });

  test('sin líneas con tipo, o con un tipo sin intervalos útiles, responde una lista vacía', async () => {
    const { orden, tokens } = await escenarioOrden();
    await ligar(orden.id, null);
    const res = await pedir(tokens.admin, orden.id);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('un tipo desactivado después de usarse sigue proponiendo su intervalo', async () => {
    const { orden, tokens } = await escenarioOrden();
    const aceite = await createServiceType({ active: false });
    await ligar(orden.id, aceite);
    expect((await pedir(tokens.admin, orden.id)).body.data).toHaveLength(1);
  });

  test('la fecha propuesta nunca es anterior a hoy y el kilometraje propuesto es mayor al actual del vehículo', async () => {
    const { orden, vehicle, tokens } = await escenarioOrden();
    await kilometrajeDelVehiculo(vehicle.id, 90000);
    await pool.query('UPDATE service_orders SET service_mileage = 80000 WHERE id = ?', [orden.id]);
    const tipo = await createServiceType({ intervalDays: 1, intervalKm: 1 });
    await ligar(orden.id, tipo);

    const [sugerencia] = (await pedir(tokens.admin, orden.id)).body.data;

    expect(sugerencia.dueDate >= todayLocal()).toBe(true);
    expect(sugerencia.dueMileage).toBeGreaterThan(90000);
  });

  test('usa el kilometraje del servicio de la orden cuando existe', async () => {
    const { orden, vehicle, tokens } = await escenarioOrden();
    await kilometrajeDelVehiculo(vehicle.id, 50000);
    await pool.query('UPDATE service_orders SET service_mileage = 50500 WHERE id = ?', [orden.id]);
    const tipo = await createServiceType({ intervalDays: null, intervalKm: 5000 });
    await ligar(orden.id, tipo);

    expect((await pedir(tokens.admin, orden.id)).body.data[0].dueMileage).toBe(55500);
  });
});

describe('permisos', () => {
  test.each([['admin'], ['recepcion'], ['mecanico']])('la puede pedir %s', async (quien) => {
    const { orden, tokens } = await escenarioOrden();
    expect((await pedir(tokens[quien], orden.id)).status).toBe(200);
  });

  test('otro mecánico recibe 403 FORBIDDEN', async () => {
    const { orden, tokens } = await escenarioOrden();
    const res = await pedir(tokens.otro, orden.id);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('una orden inexistente responde 404 y un identificador inválido 400', async () => {
    const { tokens } = await escenarioOrden();
    expect((await pedir(tokens.admin, 99999)).status).toBe(404);
    expect((await pedir(tokens.admin, 'abc')).status).toBe(400);
  });

  test('sin token responde 401', async () => {
    const { orden } = await escenarioOrden();
    expect((await request(app).get(`/api/orders/${orden.id}/maintenance-suggestion`)).status).toBe(401);
  });
});
