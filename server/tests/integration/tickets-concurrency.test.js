import { resetTables, closePool, pool, createClient, createVehicle, createOrder, addServiceLine } from '../helpers/db.js';
import { escenarioPago } from '../helpers/payments.js';
import request from 'supertest';
import app from '../../app.js';
import { bearer } from '../helpers/auth.js';

const generar = (token, orderId) => request(app).post(`/api/orders/${orderId}/ticket`).set(bearer(token));

describe('concurrencia al generar tickets', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('dos solicitudes simultáneas para la misma orden producen un solo folio y una sola fila', async () => {
    const { orden, tokens } = await escenarioPago();
    const respuestas = await Promise.all([generar(tokens.recepcion, orden.id), generar(tokens.admin, orden.id)]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(respuestas[0].body.data.folio).toBe(respuestas[1].body.data.folio);
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM tickets WHERE order_id = ?', [orden.id]);
    expect(total).toBe(1);
  });

  test('solicitudes simultáneas para órdenes distintas producen folios distintos y consecutivos', async () => {
    const { orden, tokens, mecanico } = await escenarioPago();
    const ordenes = [orden];
    for (let i = 0; i < 4; i += 1) {
      const client = await createClient({ name: `Cliente ${i}`, phone: `55500000${i}0` });
      const vehicle = await createVehicle({ clientId: client.id, licensePlate: `PLA${i}000` });
      const nueva = await createOrder({ clientId: client.id, vehicleId: vehicle.id, mechanicId: mecanico.id, status: 'TERMINADO' });
      await addServiceLine(nueva.id, 'Servicio', 100);
      ordenes.push(nueva);
    }
    const respuestas = await Promise.all(ordenes.map((o) => generar(tokens.recepcion, o.id)));
    expect(respuestas.every((r) => r.status === 201)).toBe(true);
    const numeros = respuestas.map((r) => Number(r.body.data.folio.split('-')[2])).sort((a, b) => a - b);
    expect(numeros).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(respuestas.map((r) => r.body.data.folio)).size).toBe(5);
  });
});
