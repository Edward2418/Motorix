import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createClient, createVehicle, createAppointment, createPart, createOrderPart, createMaintenance } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';
import { createPayment, createTicket } from '../helpers/db.js';

afterAll(closePool);

describe('citas y órdenes: nada se elimina', () => {
  beforeEach(resetTables);

  test('no existe ninguna ruta DELETE sobre órdenes ni citas', async () => {
    const { orden, tokens, client, vehicle } = await escenarioOrden();
    const cita = await createAppointment({ clientId: client.id, vehicleId: vehicle.id });

    // Administración y recepción reciben 404 (la ruta no existe); el mecánico recibe 403 en citas
    // porque ese módulo le está vedado por completo, y 404 en órdenes.
    for (const rol of ['admin', 'recepcion', 'mecanico']) {
      expect({ rol, status: (await request(app).delete(`/api/orders/${orden.id}`).set(bearer(tokens[rol]))).status }).toEqual({
        rol,
        status: 404
      });
      const citaRes = await request(app).delete(`/api/appointments/${cita.id}`).set(bearer(tokens[rol]));
      expect({ rol, status: citaRes.status }).toEqual({ rol, status: rol === 'mecanico' ? 403 : 404 });
    }
    expect((await request(app).delete('/api/orders').set(bearer(tokens.admin))).status).toBe(404);
    expect((await request(app).delete('/api/appointments').set(bearer(tokens.admin))).status).toBe(404);
  });

  test('ninguna orden ni cita desaparece de la base tras operar sobre ellas', async () => {
    const { orden, tokens, client, vehicle } = await escenarioOrden('RECIBIDO');
    const cita = await createAppointment({ clientId: client.id, vehicleId: vehicle.id });

    await request(app).post(`/api/orders/${orden.id}/services`).set(bearer(tokens.mecanico)).send({ description: 'Servicio', amount: 10 });
    await request(app).post(`/api/orders/${orden.id}/status`).set(bearer(tokens.recepcion)).send({ status: 'CANCELADA', reason: 'Prueba' });
    await request(app).post(`/api/appointments/${cita.id}/cancel`).set(bearer(tokens.recepcion)).send({});

    const [ordenes] = await pool.query('SELECT COUNT(*) AS total FROM service_orders');
    const [citas] = await pool.query('SELECT COUNT(*) AS total FROM appointments');
    expect(ordenes[0].total).toBe(1);
    expect(citas[0].total).toBe(1);

    const detalle = await request(app).get(`/api/orders/${orden.id}`).set(bearer(tokens.admin));
    expect(detalle.body.data.status).toBe('CANCELADA');
    expect(detalle.body.data.services).toHaveLength(1);
  });

  test('la base de datos impide borrar clientes o vehículos que tienen órdenes o citas', async () => {
    const { client, vehicle } = await escenarioOrden();
    await createAppointment({ clientId: client.id, vehicleId: vehicle.id });
    await expect(pool.query('DELETE FROM vehicles WHERE id = ?', [vehicle.id])).rejects.toMatchObject({ code: 'ER_ROW_IS_REFERENCED_2' });
    await expect(pool.query('DELETE FROM clients WHERE id = ?', [client.id])).rejects.toMatchObject({ code: 'ER_ROW_IS_REFERENCED_2' });
    const otro = await createClient({ name: 'Sin datos', phone: '5500000000' });
    const sinOrdenes = await createVehicle({ clientId: otro.id, licensePlate: 'LIB0001' });
    expect(sinOrdenes.id).toBeDefined();
  });

  test('el historial de estados solo crece: no existen rutas para modificarlo', async () => {
    const { orden, tokens } = await escenarioOrden('RECIBIDO');
    for (const metodo of ['put', 'patch', 'delete']) {
      const res = await request(app)[metodo](`/api/orders/${orden.id}/history`).set(bearer(tokens.admin)).send({});
      expect({ metodo, status: res.status }).toEqual({ metodo, status: 404 });
    }
  });
});

describe('refacciones, movimientos y mantenimientos: nada se elimina', () => {
  beforeEach(resetTables);

  test('no existe ninguna ruta DELETE ni de edición sobre refacciones, movimientos ni mantenimientos', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const pieza = await createPart({ code: 'BUJ-01', stock: 10 });
    const mantenimiento = await createMaintenance({ vehicleId: orden.vehicleId, orderId: orden.id, description: 'Cambio de aceite' });
    const movimientos = await request(app).get(`/api/parts/${pieza.id}/movements`).set(bearer(tokens.admin));
    const movimientoId = movimientos.body.data[0].id;

    const rutas = [
      ['delete', '/api/parts'],
      ['delete', `/api/parts/${pieza.id}`],
      ['delete', `/api/parts/${pieza.id}/movements`],
      ['delete', `/api/parts/${pieza.id}/movements/${movimientoId}`],
      ['put', `/api/parts/${pieza.id}/movements/${movimientoId}`],
      ['patch', `/api/parts/${pieza.id}/movements/${movimientoId}`],
      ['delete', '/api/maintenance'],
      ['delete', `/api/maintenance/${mantenimiento.id}`],
      ['put', `/api/maintenance/${mantenimiento.id}`],
      ['patch', `/api/maintenance/${mantenimiento.id}`]
    ];
    for (const rol of ['admin', 'recepcion', 'mecanico']) {
      for (const [metodo, ruta] of rutas) {
        const res = await request(app)[metodo](ruta).set(bearer(tokens[rol])).send({});
        expect({ rol, metodo, ruta, status: res.status }).toEqual({ rol, metodo, ruta, status: 404 });
      }
    }
  });

  test('la base impide borrar refacciones, órdenes o vehículos que tienen movimientos, líneas o mantenimientos', async () => {
    const { orden, vehicle, client } = await escenarioOrden('EN_REPARACION');
    const pieza = await createPart({ code: 'BUJ-01', stock: 10 });
    await createOrderPart({ orderId: orden.id, partId: pieza.id, quantity: 2 });
    await createMaintenance({ vehicleId: vehicle.id, orderId: orden.id, description: 'Cambio de aceite' });

    const restringido = { code: 'ER_ROW_IS_REFERENCED_2' };
    await expect(pool.query('DELETE FROM parts WHERE id = ?', [pieza.id])).rejects.toMatchObject(restringido);
    await expect(pool.query('DELETE FROM service_orders WHERE id = ?', [orden.id])).rejects.toMatchObject(restringido);
    await expect(pool.query('DELETE FROM vehicles WHERE id = ?', [vehicle.id])).rejects.toMatchObject(restringido);
    await expect(pool.query('DELETE FROM clients WHERE id = ?', [client.id])).rejects.toMatchObject(restringido);
  });

  test('desactivar una refacción conserva sus movimientos y líneas', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const pieza = await createPart({ code: 'BUJ-01', stock: 10 });
    await createOrderPart({ orderId: orden.id, partId: pieza.id, quantity: 2 });
    await request(app).patch(`/api/parts/${pieza.id}/status`).set(bearer(tokens.admin)).send({ active: false });

    const [[movimientos]] = await pool.query('SELECT COUNT(*) AS total FROM inventory_movements WHERE part_id = ?', [pieza.id]);
    const [[lineas]] = await pool.query('SELECT COUNT(*) AS total FROM order_parts WHERE part_id = ?', [pieza.id]);
    expect(movimientos.total).toBe(2);
    expect(lineas.total).toBe(1);
  });
});

describe('pagos y tickets: nada se elimina', () => {
  beforeEach(resetTables);

  test('no existe ruta para borrar o editar pagos ni tickets y la base impide borrar lo referenciado', async () => {
    const { orden, tokens } = await escenarioOrden('TERMINADO');
    const pago = await createPayment({ orderId: orden.id, amount: 100, status: 'CANCELADO' });
    await createTicket({ orderId: orden.id, folio: 'TK-2026-0001', orderTotal: 0 });
    for (const rol of ['admin', 'recepcion', 'mecanico']) {
      for (const [metodo, ruta] of [
        ['delete', `/api/payments/${pago.id}`],
        ['put', `/api/payments/${pago.id}`],
        ['patch', `/api/payments/${pago.id}`],
        ['delete', `/api/orders/${orden.id}/payments`],
        ['delete', `/api/orders/${orden.id}/ticket`],
        ['put', `/api/orders/${orden.id}/ticket`]
      ]) {
        const res = await request(app)[metodo](ruta).set(bearer(tokens[rol]));
        expect({ rol, metodo, ruta, status: res.status }).toEqual({ rol, metodo, ruta, status: rol === 'mecanico' && ruta.includes('/payments/') ? 403 : 404 });
      }
    }
    await expect(pool.query('DELETE FROM service_orders WHERE id = ?', [orden.id])).rejects.toMatchObject({ code: 'ER_ROW_IS_REFERENCED_2' });
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM payments WHERE id = ?', [pago.id]);
    expect(total).toBe(1);
  });
});
