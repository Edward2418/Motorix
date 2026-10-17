import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, pool, createPayment } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioPago, listarPagos } from '../helpers/payments.js';

afterAll(closePool);

// Caso límite del spec (hallazgo D6): desactivar un cliente o un vehículo no esconde sus pagos ni sus tickets.
describe('pagos y tickets de clientes y vehículos desactivados', () => {
  beforeEach(resetTables);

  test('los pagos y el ticket siguen consultables cuando el cliente y el vehículo se desactivan', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'ENTREGADO', total: 800 });
    await createPayment({ orderId: orden.id, amount: 300, method: 'EFECTIVO' });
    const generado = await request(app).post(`/api/orders/${orden.id}/ticket`).set(bearer(tokens.recepcion));
    expect(generado.status).toBe(201);

    await pool.query('UPDATE vehicles SET active = 0 WHERE id = ?', [orden.vehicleId]);
    await pool.query('UPDATE clients SET active = 0 WHERE id = ?', [orden.clientId]);

    for (const rol of ['admin', 'recepcion']) {
      const pagos = await listarPagos(tokens[rol], orden.id);
      expect({ rol, status: pagos.status }).toEqual({ rol, status: 200 });
      expect(pagos.body.data.payments).toHaveLength(1);
      expect(pagos.body.data.payments[0]).toMatchObject({ amount: 300, method: 'EFECTIVO', status: 'PAGADO' });
      expect(pagos.body.data.summary).toMatchObject({ collected: 300, balance: 500 });

      const ticket = await request(app).get(`/api/orders/${orden.id}/ticket`).set(bearer(tokens[rol]));
      expect({ rol, status: ticket.status }).toEqual({ rol, status: 200 });
      expect(ticket.body.data.folio).toBe(generado.body.data.folio);
    }

    const detalle = await request(app).get(`/api/orders/${orden.id}`).set(bearer(tokens.recepcion));
    expect(detalle.status).toBe(200);
    expect(detalle.body.data.payment).toMatchObject({ collected: 300 });
  });

  test('el panel sigue contando lo cobrado de una orden cuyo cliente se desactivó', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'ENTREGADO', total: 500 });
    await createPayment({ orderId: orden.id, amount: 500, method: 'TRANSFERENCIA' });
    await pool.query('UPDATE clients SET active = 0 WHERE id = ?', [orden.clientId]);

    const panel = await request(app).get('/api/dashboard?period=month').set(bearer(tokens.admin));
    expect(panel.status).toBe(200);
    expect(panel.body.data.indicators.collected).toBe(500);
  });
});
