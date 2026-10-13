import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';

const cambiar = (token, orderId, body) => request(app).post(`/api/orders/${orderId}/status`).set(bearer(token)).send(body);
const corregir = (token, orderId, body) => request(app).put(`/api/orders/${orderId}/service-mileage`).set(bearer(token)).send(body);

const kmDelVehiculo = async (vehicleId) => (await pool.query('SELECT current_mileage FROM vehicles WHERE id = ?', [vehicleId]))[0][0].current_mileage;
const filaOrden = async (orderId) =>
  (await pool.query('SELECT status, service_mileage, service_mileage_correction_reason, service_mileage_corrected_by FROM service_orders WHERE id = ?', [orderId]))[0][0];

// La orden de la prueba entra con 1000 km; el vehículo se deja en 2000 km para distinguir cuándo se actualiza.
async function escenario(status = 'EN_REPARACION') {
  const datos = await escenarioOrden(status);
  await pool.query('UPDATE vehicles SET current_mileage = 2000 WHERE id = ?', [datos.vehicle.id]);
  return datos;
}

afterAll(closePool);

describe('kilometraje del servicio al terminar la orden', () => {
  beforeEach(resetTables);

  test('terminar sin kilometraje del servicio se rechaza con 400 y la orden no cambia', async () => {
    const { orden, tokens } = await escenario();
    const res = await cambiar(tokens.mecanico, orden.id, { status: 'TERMINADO' });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'serviceMileage', message: expect.stringMatching(/obligatorio/i) }]);
    expect((await filaOrden(orden.id)).status).toBe('EN_REPARACION');
  });

  test('un kilometraje menor al de entrada se rechaza indicando el de entrada y no toca el vehículo', async () => {
    const { orden, vehicle, tokens } = await escenario();
    const res = await cambiar(tokens.mecanico, orden.id, { status: 'TERMINADO', serviceMileage: 999 });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].message).toMatch(/1,000/);
    expect((await filaOrden(orden.id)).status).toBe('EN_REPARACION');
    expect(await kmDelVehiculo(vehicle.id)).toBe(2000);
  });

  test('un kilometraje igual al de entrada se acepta', async () => {
    const { orden, tokens } = await escenario();
    const res = await cambiar(tokens.mecanico, orden.id, { status: 'TERMINADO', serviceMileage: 1000 });
    expect(res.status).toBe(200);
    expect(res.body.data.serviceMileage).toBe(1000);
  });

  test('un valor que no es un entero se rechaza con 400', async () => {
    const { orden, tokens } = await escenario();
    for (const serviceMileage of ['abc', 1500.5, -5, null]) {
      const res = await cambiar(tokens.mecanico, orden.id, { status: 'TERMINADO', serviceMileage });
      expect({ serviceMileage, status: res.status }).toEqual({ serviceMileage, status: 400 });
    }
  });

  test('si es mayor al del vehículo, actualiza el kilometraje actual en la misma operación', async () => {
    const { orden, vehicle, tokens } = await escenario();
    const res = await cambiar(tokens.mecanico, orden.id, { status: 'TERMINADO', serviceMileage: 2500 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'TERMINADO', serviceMileage: 2500 });
    expect(await kmDelVehiculo(vehicle.id)).toBe(2500);
    expect((await filaOrden(orden.id)).service_mileage).toBe(2500);
  });

  test('si es igual o menor al del vehículo, el kilometraje del vehículo no cambia', async () => {
    const { orden, vehicle, tokens } = await escenario();
    const res = await cambiar(tokens.mecanico, orden.id, { status: 'TERMINADO', serviceMileage: 1500 });
    expect(res.status).toBe(200);
    expect(await kmDelVehiculo(vehicle.id)).toBe(2000);
  });

  test('un mecánico no asignado recibe 403 aunque falte el kilometraje', async () => {
    const { orden, tokens } = await escenario('EN_REPARACION');
    const res = await cambiar(tokens.otro, orden.id, { status: 'TERMINADO' });
    expect(res.status).toBe(403);
  });

  test('una transición inválida recibe 409 aunque falte el kilometraje', async () => {
    const { orden, tokens } = await escenario('RECIBIDO');
    const res = await cambiar(tokens.mecanico, orden.id, { status: 'TERMINADO' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  test('recepción y administración también deben indicar el kilometraje al terminar', async () => {
    const { orden, tokens } = await escenario();
    expect((await cambiar(tokens.admin, orden.id, { status: 'TERMINADO' })).status).toBe(400);
    expect((await cambiar(tokens.recepcion, orden.id, { status: 'TERMINADO', serviceMileage: 1800 })).status).toBe(200);
  });

  test('otros cambios de estado no piden kilometraje del servicio', async () => {
    const { orden, tokens } = await escenario('DIAGNOSTICO');
    const res = await cambiar(tokens.mecanico, orden.id, { status: 'EN_REPARACION' });
    expect(res.status).toBe(200);
    expect(res.body.data.serviceMileage).toBeNull();
  });
});

describe('corrección del kilometraje del servicio', () => {
  beforeEach(resetTables);

  test('solo ADMIN puede corregirlo; recepción y mecánico reciben 403', async () => {
    const { orden, tokens } = await escenario('TERMINADO');
    for (const rol of ['recepcion', 'mecanico', 'otro']) {
      const res = await corregir(tokens[rol], orden.id, { serviceMileage: 1200, reason: 'Error de captura' });
      expect({ rol, status: res.status }).toEqual({ rol, status: 403 });
    }
  });

  test('solo se corrige en órdenes TERMINADO o ENTREGADO; en otro estado responde 409', async () => {
    const { orden, tokens } = await escenario('EN_REPARACION');
    const res = await corregir(tokens.admin, orden.id, { serviceMileage: 1200, reason: 'Error de captura' });
    expect(res.status).toBe(409);
  });

  test('exige el motivo y no admite un kilometraje menor al de entrada', async () => {
    const { orden, tokens } = await escenario('TERMINADO');
    const sinMotivo = await corregir(tokens.admin, orden.id, { serviceMileage: 1200 });
    expect(sinMotivo.status).toBe(400);
    expect(sinMotivo.body.error.details.map((d) => d.field)).toContain('reason');
    const menor = await corregir(tokens.admin, orden.id, { serviceMileage: 500, reason: 'Error de captura' });
    expect(menor.status).toBe(400);
    expect(menor.body.error.details[0].field).toBe('serviceMileage');
  });

  test('guarda el kilometraje, el motivo y quién lo corrigió, sin bajar el kilometraje del vehículo', async () => {
    const { orden, vehicle, tokens } = await escenario('TERMINADO');
    await pool.query('UPDATE service_orders SET service_mileage = 3000 WHERE id = ?', [orden.id]);
    await pool.query('UPDATE vehicles SET current_mileage = 3000 WHERE id = ?', [vehicle.id]);

    const res = await corregir(tokens.admin, orden.id, { serviceMileage: 1800, reason: ' Se capturó un cero de más ' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ serviceMileage: 1800, serviceMileageCorrectionReason: 'Se capturó un cero de más' });
    const fila = await filaOrden(orden.id);
    expect(fila.service_mileage).toBe(1800);
    expect(fila.service_mileage_corrected_by).not.toBeNull();
    expect(await kmDelVehiculo(vehicle.id)).toBe(3000);
  });

  test('también se corrige en una orden ENTREGADO', async () => {
    const { orden, tokens } = await escenario('ENTREGADO');
    const res = await corregir(tokens.admin, orden.id, { serviceMileage: 1900, reason: 'Lectura equivocada' });
    expect(res.status).toBe(200);
    expect(res.body.data.serviceMileage).toBe(1900);
  });

  test('una orden inexistente responde 404 y sin sesión 401', async () => {
    const { tokens } = await escenario('TERMINADO');
    expect((await corregir(tokens.admin, 99999, { serviceMileage: 1, reason: 'x' })).status).toBe(404);
    const sinSesion = await request(app).put('/api/orders/1/service-mileage').send({});
    expect(sinSesion.status).toBe(401);
  });
});
