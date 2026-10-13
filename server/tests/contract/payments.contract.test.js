import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createPayment } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioPago, registrarPago, listarPagos, cancelarPago } from '../helpers/payments.js';

const paymentShape = {
  id: expect.any(Number),
  orderId: expect.any(Number),
  orderFolio: expect.stringMatching(/^OS-\d{4}-\d{4}$/),
  amount: expect.any(Number),
  method: expect.stringMatching(/^(EFECTIVO|TARJETA|TRANSFERENCIA|MERCADO_PAGO)$/),
  status: expect.stringMatching(/^(PENDIENTE|PAGADO|RECHAZADO|CANCELADO)$/),
  reference: null,
  paymentLink: null,
  expiresAt: null,
  paidAt: expect.any(String),
  cancelReason: null,
  createdByName: expect.any(String),
  cancelledByName: null,
  createdAt: expect.any(String)
};

const summaryShape = {
  total: expect.any(Number),
  collected: expect.any(Number),
  reserved: expect.any(Number),
  balance: expect.any(Number),
  available: expect.any(Number),
  creditBalance: expect.any(Number),
  status: expect.stringMatching(/^(SIN_PAGO|PARCIAL|PAGADA)$/)
};

describe('contrato de los pagos', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('POST /orders/{id}/payments responde 201 con payment y summary', async () => {
    const { orden, tokens } = await escenarioPago();
    const res = await registrarPago(tokens.recepcion, orden.id, { amount: 200, method: 'EFECTIVO' });
    expect(res.status).toBe(201);
    expect(res.body.data.payment).toEqual(paymentShape);
    expect(res.body.data.summary).toEqual(summaryShape);
  });

  test('GET /orders/{id}/payments responde payments y summary', async () => {
    const { orden, tokens } = await escenarioPago();
    await createPayment({ orderId: orden.id, amount: 100 });
    const res = await listarPagos(tokens.admin, orden.id);
    expect(res.status).toBe(200);
    expect(res.body.data.payments).toHaveLength(1);
    expect(res.body.data.payments[0]).toEqual(paymentShape);
    expect(res.body.data.summary).toEqual(summaryShape);
  });

  test('POST /payments/{id}/cancel responde 200 con el pago cancelado', async () => {
    const { orden, tokens } = await escenarioPago();
    const pago = await createPayment({ orderId: orden.id, amount: 100, status: 'PENDIENTE', method: 'MERCADO_PAGO' });
    const res = await cancelarPago(tokens.admin, pago.id, { reason: 'Prueba de contrato' });
    expect(res.status).toBe(200);
    expect(res.body.data.payment).toEqual({
      ...paymentShape,
      status: 'CANCELADO',
      method: 'MERCADO_PAGO',
      paidAt: null,
      cancelReason: 'Prueba de contrato',
      cancelledByName: expect.any(String)
    });
    expect(res.body.data.summary).toEqual(summaryShape);
  });

  test('los errores usan el formato { error: { code, message } }', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'RECIBIDO' });
    const casos = [
      [await registrarPago(tokens.recepcion, orden.id, { amount: -1, method: 'EFECTIVO' }), 400, 'VALIDATION_ERROR'],
      [await request(app).get(`/api/orders/${orden.id}/payments`), 401, 'UNAUTHENTICATED'],
      [await listarPagos(tokens.mecanico, orden.id), 403, 'FORBIDDEN'],
      [await listarPagos(tokens.admin, 999999), 404, 'NOT_FOUND'],
      [await registrarPago(tokens.recepcion, orden.id, { amount: 10, method: 'EFECTIVO' }), 409, 'ORDER_NOT_PAYABLE']
    ];
    for (const [res, status, code] of casos) {
      expect({ code, status: res.status }).toEqual({ code, status });
      expect(res.body.error).toMatchObject({ code, message: expect.any(String) });
    }
  });

  test('GET /payments/config responde methods y mercadoPagoEnabled', async () => {
    const { tokens } = await escenarioPago();
    const res = await request(app).get('/api/payments/config').set(bearer(tokens.recepcion));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      methods: ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'MERCADO_PAGO'],
      mercadoPagoEnabled: expect.any(Boolean)
    });
  });

  test('una referencia con forma de tarjeta responde 400 con el campo reference', async () => {
    const { orden, tokens } = await escenarioPago();
    const res = await registrarPago(tokens.recepcion, orden.id, { amount: 10, method: 'TARJETA', reference: '4111111111111111' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR', details: [{ field: 'reference', message: expect.any(String) }] });
  });

  test('un identificador inválido responde 400', async () => {
    const { tokens } = await escenarioPago();
    const res = await request(app).get('/api/orders/abc/payments').set(bearer(tokens.admin));
    expect(res.status).toBe(400);
  });
});
