import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createAppointment } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';

// Sin segundo argumento usa un motivo válido; pasar `undefined` explícito envía la petición sin motivo.
const cancelar = (token, orderId, ...resto) => {
  const reason = resto.length > 0 ? resto[0] : 'El cliente ya no quiere el servicio';
  const body = reason === undefined ? { status: 'CANCELADA' } : { status: 'CANCELADA', reason };
  return request(app).post(`/api/orders/${orderId}/status`).set(bearer(token)).send(body);
};

const fila = async (orderId) => (await pool.query('SELECT * FROM service_orders WHERE id = ?', [orderId]))[0][0];

describe('órdenes: cancelación', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('se cancela con motivo desde los cuatro estados abiertos y conserva su contenido', async () => {
    for (const estado of ['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION']) {
      await resetTables();
      const { orden, tokens } = await escenarioOrden(estado);
      await pool.query("INSERT INTO order_services (order_id, description, cost) VALUES (?, 'Servicio previo', 100)", [orden.id]);
      await pool.query("INSERT INTO order_labor (order_id, description, amount) VALUES (?, 'Mano de obra previa', 50)", [orden.id]);

      const res = await cancelar(tokens.recepcion, orden.id);
      expect({ estado, status: res.status }).toEqual({ estado, status: 200 });
      expect(res.body.data).toMatchObject({
        status: 'CANCELADA',
        cancelReason: 'El cliente ya no quiere el servicio',
        total: 150
      });
      expect(res.body.data.services).toHaveLength(1);
      expect(res.body.data.labor).toHaveLength(1);
      const ultimo = res.body.data.history.at(-1);
      expect(ultimo).toMatchObject({ fromStatus: estado, toStatus: 'CANCELADA', reason: 'El cliente ya no quiere el servicio' });
    }
  });

  test('administración también puede cancelar', async () => {
    const { orden, tokens } = await escenarioOrden('RECIBIDO');
    expect((await cancelar(tokens.admin, orden.id)).status).toBe(200);
  });

  test('sin motivo o con motivo vacío responde 400 y la orden no cambia', async () => {
    const { orden, tokens } = await escenarioOrden('DIAGNOSTICO');
    for (const motivo of [undefined, '', '   ']) {
      const res = await cancelar(tokens.recepcion, orden.id, motivo);
      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d) => d.field)).toContain('reason');
    }
    expect((await fila(orden.id)).status).toBe('DIAGNOSTICO');
  });

  test('el motivo admite hasta 255 caracteres', async () => {
    const { orden, tokens } = await escenarioOrden('RECIBIDO');
    expect((await cancelar(tokens.recepcion, orden.id, 'x'.repeat(256))).status).toBe(400);
    expect((await cancelar(tokens.recepcion, orden.id, 'x'.repeat(255))).status).toBe(200);
  });

  test('desde TERMINADO, ENTREGADO o CANCELADA responde 409', async () => {
    for (const estado of ['TERMINADO', 'ENTREGADO', 'CANCELADA']) {
      await resetTables();
      const { orden, tokens } = await escenarioOrden(estado);
      const res = await cancelar(tokens.admin, orden.id);
      expect({ estado, status: res.status }).toEqual({ estado, status: 409 });
      expect((await fila(orden.id)).status).toBe(estado);
    }
  });

  test('el mecánico, aunque sea el asignado, recibe 403', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const res = await cancelar(tokens.mecanico, orden.id);
    expect(res.status).toBe(403);
    expect((await fila(orden.id)).status).toBe('EN_REPARACION');
  });

  test('el vehículo queda libre para una orden nueva', async () => {
    const { orden, client, vehicle, mecanico, tokens } = await escenarioOrden('RECIBIDO');
    const nueva = { clientId: client.id, vehicleId: vehicle.id, mechanicId: mecanico.id, entryMileage: 10, reportedProblem: 'Nueva' };

    expect((await request(app).post('/api/orders').set(bearer(tokens.recepcion)).send(nueva)).status).toBe(409);
    await cancelar(tokens.recepcion, orden.id);
    expect((await request(app).post('/api/orders').set(bearer(tokens.recepcion)).send(nueva)).status).toBe(201);
  });

  test('la orden cancelada no puede editarse y no desaparece', async () => {
    const { orden, tokens } = await escenarioOrden('RECIBIDO');
    await cancelar(tokens.recepcion, orden.id);

    expect((await request(app).patch(`/api/orders/${orden.id}`).set(bearer(tokens.admin)).send({ notes: 'No' })).status).toBe(409);
    expect(
      (await request(app).post(`/api/orders/${orden.id}/services`).set(bearer(tokens.admin)).send({ description: 'No', amount: 1 })).status
    ).toBe(409);
    expect((await request(app).delete(`/api/orders/${orden.id}`).set(bearer(tokens.admin))).status).toBe(404);
    expect(await fila(orden.id)).toBeDefined();
    expect((await request(app).get(`/api/orders/${orden.id}`).set(bearer(tokens.admin))).status).toBe(200);
  });

  test('la cancelación conserva su folio y aparece en el listado', async () => {
    const { orden, tokens } = await escenarioOrden('RECIBIDO');
    await cancelar(tokens.recepcion, orden.id);
    const lista = await request(app).get('/api/orders?status=CANCELADA').set(bearer(tokens.recepcion));
    expect(lista.body.data.map((o) => o.folio)).toEqual([orden.folio]);
  });

  test('cancelar la orden cancela la cita vinculada con el mismo motivo', async () => {
    const { orden, client, vehicle, tokens } = await escenarioOrden('DIAGNOSTICO');
    const cita = await createAppointment({ clientId: client.id, vehicleId: vehicle.id, status: 'EN_PROCESO' });
    await pool.query('UPDATE service_orders SET appointment_id = ? WHERE id = ?', [cita.id, orden.id]);

    await cancelar(tokens.recepcion, orden.id, 'Se pospone el servicio');
    const [filas] = await pool.query('SELECT status, cancel_reason FROM appointments WHERE id = ?', [cita.id]);
    expect(filas[0]).toEqual({ status: 'CANCELADA', cancel_reason: 'Se pospone el servicio' });
  });
});
