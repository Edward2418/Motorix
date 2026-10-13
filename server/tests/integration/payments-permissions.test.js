import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, pool, createPayment } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioPago, registrarPago, listarPagos, cancelarPago } from '../helpers/payments.js';

describe('permisos de los pagos', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('ADMIN y RECEPTIONIST registran y consultan pagos', async () => {
    const { orden, tokens } = await escenarioPago({ total: 1000 });
    for (const rol of ['admin', 'recepcion']) {
      const creado = await registrarPago(tokens[rol], orden.id, { amount: 100, method: 'EFECTIVO' });
      expect({ rol, status: creado.status }).toEqual({ rol, status: 201 });
      const lista = await listarPagos(tokens[rol], orden.id);
      expect({ rol, status: lista.status }).toEqual({ rol, status: 200 });
    }
  });

  test('el mecánico recibe 403 al registrar, consultar y cancelar', async () => {
    const { orden, tokens } = await escenarioPago();
    const pago = await createPayment({ orderId: orden.id, amount: 100, status: 'PENDIENTE', method: 'MERCADO_PAGO' });
    for (const rol of ['mecanico', 'otro']) {
      expect((await registrarPago(tokens[rol], orden.id, { amount: 10, method: 'EFECTIVO' })).status).toBe(403);
      expect((await listarPagos(tokens[rol], orden.id)).status).toBe(403);
      expect((await cancelarPago(tokens[rol], pago.id, { reason: 'Prueba' })).status).toBe(403);
    }
  });

  test('sin sesión responde 401', async () => {
    const { orden } = await escenarioPago();
    expect((await request(app).post(`/api/orders/${orden.id}/payments`).send({ amount: 10, method: 'EFECTIVO' })).status).toBe(401);
    expect((await request(app).get(`/api/orders/${orden.id}/payments`)).status).toBe(401);
    expect((await request(app).post('/api/payments/1/cancel').send({ reason: 'x' })).status).toBe(401);
  });

  test('el detalle y el listado de órdenes incluyen el pago solo para administración y recepción', async () => {
    const { orden, tokens } = await escenarioPago();
    for (const rol of ['admin', 'recepcion']) {
      const detalle = await request(app).get(`/api/orders/${orden.id}`).set(bearer(tokens[rol]));
      expect(detalle.body.data.payment).toBeDefined();
      const lista = await request(app).get('/api/orders').set(bearer(tokens[rol]));
      expect(lista.body.data[0].paymentStatus).toBeDefined();
    }
    const detalle = await request(app).get(`/api/orders/${orden.id}`).set(bearer(tokens.mecanico));
    expect(detalle.status).toBe(200);
    expect(detalle.body.data).not.toHaveProperty('payment');
    expect(detalle.body.data).not.toHaveProperty('paymentStatus');
    const lista = await request(app).get('/api/orders').set(bearer(tokens.mecanico));
    expect(lista.body.data[0]).not.toHaveProperty('paymentStatus');
    expect(lista.body.data[0]).not.toHaveProperty('payment');
  });

  test('no se puede eliminar ni modificar un pago por la API', async () => {
    const { orden, tokens } = await escenarioPago();
    const pago = await createPayment({ orderId: orden.id, amount: 100 });
    for (const [metodo, ruta] of [
      ['delete', `/api/payments/${pago.id}`],
      ['put', `/api/payments/${pago.id}`],
      ['patch', `/api/payments/${pago.id}`],
      ['delete', `/api/orders/${orden.id}/payments`]
    ]) {
      const res = await request(app)[metodo](ruta).set(bearer(tokens.admin));
      expect({ metodo, ruta, status: res.status }).toEqual({ metodo, ruta, status: 404 });
    }
  });

  test('la base impide borrar una orden con pagos', async () => {
    const { orden } = await escenarioPago();
    await createPayment({ orderId: orden.id, amount: 100 });
    await expect(pool.query('DELETE FROM service_orders WHERE id = ?', [orden.id])).rejects.toMatchObject({
      code: 'ER_ROW_IS_REFERENCED_2'
    });
  });
});
