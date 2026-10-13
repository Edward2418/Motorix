import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createClient, createVehicle, createAppointment } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';

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
