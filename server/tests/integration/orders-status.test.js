import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createAppointment } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';

const cambiar = (token, orderId, body) => request(app).post(`/api/orders/${orderId}/status`).set(bearer(token)).send(body);

const estadoDe = async (orderId) =>
  (await pool.query('SELECT status, delivered_at FROM service_orders WHERE id = ?', [orderId]))[0][0];

describe('órdenes: cambios de estado', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('recorrido completo: el mecánico llega a TERMINADO y recepción entrega', async () => {
    const { orden, tokens } = await escenarioOrden('RECIBIDO');
    const camino = [
      ['mecanico', 'DIAGNOSTICO'],
      ['mecanico', 'EN_REPARACION'],
      ['mecanico', 'ESPERANDO_REFACCION'],
      ['mecanico', 'EN_REPARACION'],
      ['mecanico', 'TERMINADO'],
      ['recepcion', 'ENTREGADO']
    ];
    for (const [quien, destino] of camino) {
      const res = await cambiar(tokens[quien], orden.id, { status: destino, serviceMileage: 5000 });
      expect({ destino, status: res.status }).toEqual({ destino, status: 200 });
      expect(res.body.data.status).toBe(destino);
    }

    const detalle = await request(app).get(`/api/orders/${orden.id}`).set(bearer(tokens.admin));
    expect(detalle.body.data.history.map((h) => `${h.fromStatus ?? '—'}>${h.toStatus}`)).toEqual([
      '—>RECIBIDO',
      'RECIBIDO>DIAGNOSTICO',
      'DIAGNOSTICO>EN_REPARACION',
      'EN_REPARACION>ESPERANDO_REFACCION',
      'ESPERANDO_REFACCION>EN_REPARACION',
      'EN_REPARACION>TERMINADO',
      'TERMINADO>ENTREGADO'
    ]);
    expect(detalle.body.data.history[1].changedBy).toBe('Mecánico Asignado');
    expect(detalle.body.data.history[6].changedBy).toMatch(/receptionist/i);
    expect(detalle.body.data.allowedTransitions).toEqual([]);
  });

  test('registra la fecha de entrega solo al entregar', async () => {
    const { orden, tokens } = await escenarioOrden('TERMINADO');
    expect((await estadoDe(orden.id)).delivered_at).toBeNull();
    const res = await cambiar(tokens.recepcion, orden.id, { status: 'ENTREGADO' });
    expect(res.body.data.deliveredAt).toEqual(expect.any(String));
    expect((await estadoDe(orden.id)).delivered_at).not.toBeNull();
  });

  test('rechaza saltos y retrocesos con 409', async () => {
    const { orden, tokens } = await escenarioOrden('DIAGNOSTICO');
    for (const destino of ['RECIBIDO', 'DIAGNOSTICO', 'TERMINADO', 'ENTREGADO', 'ESPERANDO_REFACCION']) {
      const res = await cambiar(tokens.admin, orden.id, { status: destino });
      expect({ destino, status: res.status }).toEqual({ destino, status: 409 });
      expect(res.body.error.code).toBe('INVALID_TRANSITION');
    }
    expect((await estadoDe(orden.id)).status).toBe('DIAGNOSTICO');
  });

  test('administración y recepción también pueden avanzar estados intermedios', async () => {
    const { orden, tokens } = await escenarioOrden('RECIBIDO');
    expect((await cambiar(tokens.recepcion, orden.id, { status: 'DIAGNOSTICO' })).status).toBe(200);
    expect((await cambiar(tokens.admin, orden.id, { status: 'EN_REPARACION' })).status).toBe(200);
  });

  test('otro mecánico recibe 403 en cualquier cambio', async () => {
    const { orden, tokens } = await escenarioOrden('RECIBIDO');
    const res = await cambiar(tokens.otro, orden.id, { status: 'DIAGNOSTICO' });
    expect(res.status).toBe(403);
    expect((await estadoDe(orden.id)).status).toBe('RECIBIDO');
  });

  test('el mecánico asignado recibe 403 al pedir ENTREGADO o CANCELADA', async () => {
    const { orden, tokens } = await escenarioOrden('TERMINADO');
    const entregar = await cambiar(tokens.mecanico, orden.id, { status: 'ENTREGADO' });
    expect(entregar.status).toBe(403);
    expect((await estadoDe(orden.id)).status).toBe('TERMINADO');

    await resetTables();
    const otra = await escenarioOrden('EN_REPARACION');
    const cancelar = await cambiar(otra.tokens.mecanico, otra.orden.id, { status: 'CANCELADA', reason: 'No quiere' });
    expect(cancelar.status).toBe(403);
  });

  test('una orden ENTREGADO o CANCELADA no admite más cambios', async () => {
    for (const final of ['ENTREGADO', 'CANCELADA']) {
      await resetTables();
      const { orden, tokens } = await escenarioOrden(final);
      for (const destino of ['DIAGNOSTICO', 'EN_REPARACION', 'TERMINADO', 'ENTREGADO']) {
        const res = await cambiar(tokens.admin, orden.id, { status: destino });
        expect({ final, destino, status: res.status }).toEqual({ final, destino, status: 409 });
      }
    }
  });

  test('un estado inexistente o ausente responde 400', async () => {
    const { orden, tokens } = await escenarioOrden();
    expect((await cambiar(tokens.admin, orden.id, { status: 'INVENTADO' })).status).toBe(400);
    expect((await cambiar(tokens.admin, orden.id, {})).status).toBe(400);
    expect((await cambiar(tokens.admin, orden.id, { status: 5 })).status).toBe(400);
  });

  test('una orden inexistente responde 404, un identificador inválido 400 y sin token 401', async () => {
    const { tokens } = await escenarioOrden();
    expect((await cambiar(tokens.admin, 9999, { status: 'DIAGNOSTICO' })).status).toBe(404);
    expect((await cambiar(tokens.admin, 'abc', { status: 'DIAGNOSTICO' })).status).toBe(400);
    expect((await request(app).post('/api/orders/1/status').send({ status: 'DIAGNOSTICO' })).status).toBe(401);
  });

  test('dos cambios simultáneos desde el mismo estado: solo uno se aplica y el historial no se corrompe', async () => {
    const { orden, tokens } = await escenarioOrden('RECIBIDO');
    const [a, b] = await Promise.all([
      cambiar(tokens.mecanico, orden.id, { status: 'DIAGNOSTICO' }),
      cambiar(tokens.recepcion, orden.id, { status: 'DIAGNOSTICO' })
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);

    const [historial] = await pool.query(
      "SELECT from_status, to_status FROM order_status_history WHERE order_id = ? AND to_status = 'DIAGNOSTICO'",
      [orden.id]
    );
    expect(historial).toHaveLength(1);
    expect((await estadoDe(orden.id)).status).toBe('DIAGNOSTICO');
  });

  test('entregar la orden deja COMPLETADA la cita vinculada', async () => {
    const { orden, client, vehicle, tokens } = await escenarioOrden('TERMINADO');
    const cita = await createAppointment({ clientId: client.id, vehicleId: vehicle.id, status: 'EN_PROCESO' });
    await pool.query('UPDATE service_orders SET appointment_id = ? WHERE id = ?', [cita.id, orden.id]);

    await cambiar(tokens.recepcion, orden.id, { status: 'ENTREGADO' });
    const [filas] = await pool.query('SELECT status FROM appointments WHERE id = ?', [cita.id]);
    expect(filas[0].status).toBe('COMPLETADA');
  });

  test('cambiar de estado sin cita vinculada no falla', async () => {
    const { orden, tokens } = await escenarioOrden('TERMINADO');
    expect((await cambiar(tokens.recepcion, orden.id, { status: 'ENTREGADO' })).status).toBe(200);
  });

  test('un cambio que falla a mitad de camino no deja el estado a medias (transacción)', async () => {
    const { orden, tokens } = await escenarioOrden('RECIBIDO');
    await pool.query('RENAME TABLE order_status_history TO order_status_history_tmp');
    let res;
    try {
      res = await cambiar(tokens.mecanico, orden.id, { status: 'DIAGNOSTICO' });
    } finally {
      await pool.query('RENAME TABLE order_status_history_tmp TO order_status_history');
    }
    expect(res.status).toBe(500);
    expect((await estadoDe(orden.id)).status).toBe('RECIBIDO');
  });
});
