import request from 'supertest';
import app from '../../app.js';
import { AppError } from '../../utils/AppError.js';
import { resetTables, closePool, pool } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { createFakeGateway, installFakeGateway, uninstallFakeGateway } from '../helpers/fakeGateway.js';
import { escenarioPago, registrarPago } from '../helpers/payments.js';

const actualizar = (token, paymentId) => request(app).post(`/api/payments/${paymentId}/refresh`).set(bearer(token));

describe('contrato de los pagos con Mercado Pago', () => {
  let gateway;

  beforeEach(async () => {
    await resetTables();
    gateway = createFakeGateway({ enabled: true });
    await installFakeGateway(gateway);
  });
  afterAll(async () => {
    await uninstallFakeGateway();
    await closePool();
  });

  test('POST /orders/{id}/payments con MERCADO_PAGO responde 201 PENDIENTE con paymentLink', async () => {
    const { orden, tokens } = await escenarioPago();
    const res = await registrarPago(tokens.recepcion, orden.id, { amount: 300, method: 'MERCADO_PAGO' });
    expect(res.status).toBe(201);
    expect(res.body.data.payment).toMatchObject({
      method: 'MERCADO_PAGO',
      status: 'PENDIENTE',
      paymentLink: expect.stringMatching(/^https:\/\//),
      expiresAt: expect.any(String),
      paidAt: null
    });
    expect(Object.keys(res.body.data).sort()).toEqual(['payment', 'summary']);
  });

  test('POST /payments/{id}/refresh responde 200 con payment, summary y warning', async () => {
    const { orden, tokens } = await escenarioPago();
    const creado = await registrarPago(tokens.recepcion, orden.id, { amount: 300, method: 'MERCADO_PAGO' });
    const res = await actualizar(tokens.recepcion, creado.body.data.payment.id);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      payment: expect.objectContaining({ id: creado.body.data.payment.id, status: 'PENDIENTE' }),
      summary: expect.objectContaining({ reserved: 300 }),
      warning: 'STILL_PENDING'
    });
  });

  test('GET /payments/config informa mercadoPagoEnabled según la pasarela', async () => {
    const { tokens } = await escenarioPago();
    const habilitada = await request(app).get('/api/payments/config').set(bearer(tokens.admin));
    expect(habilitada.body.data.mercadoPagoEnabled).toBe(true);
    await installFakeGateway(createFakeGateway({ enabled: false }));
    const deshabilitada = await request(app).get('/api/payments/config').set(bearer(tokens.admin));
    expect(deshabilitada.body.data.mercadoPagoEnabled).toBe(false);
  });

  test('los errores usan los códigos del contrato', async () => {
    const { orden, tokens } = await escenarioPago();
    const efectivo = await registrarPago(tokens.recepcion, orden.id, { amount: 100, method: 'EFECTIVO' });
    const casos = [
      [await request(app).post('/api/payments/1/refresh'), 401, 'UNAUTHENTICATED'],
      [await actualizar(tokens.mecanico, 1), 403, 'FORBIDDEN'],
      [await actualizar(tokens.admin, 999999), 404, 'NOT_FOUND'],
      [await actualizar(tokens.admin, efectivo.body.data.payment.id), 409, 'PAYMENT_NOT_REFRESHABLE']
    ];
    gateway.failNext(AppError.serviceUnavailable('Mercado Pago no está disponible en este momento.'));
    casos.push([await registrarPago(tokens.recepcion, orden.id, { amount: 100, method: 'MERCADO_PAGO' }), 503, 'SERVICE_UNAVAILABLE']);
    await installFakeGateway(createFakeGateway({ enabled: false }));
    casos.push([await registrarPago(tokens.recepcion, orden.id, { amount: 100, method: 'MERCADO_PAGO' }), 409, 'MERCADOPAGO_NOT_CONFIGURED']);
    for (const [res, status, code] of casos) {
      expect({ code, status: res.status }).toEqual({ code, status });
      expect(res.body.error).toMatchObject({ code, message: expect.any(String) });
    }
    const [[{ total }]] = await pool.query("SELECT COUNT(*) AS total FROM payments WHERE method = 'MERCADO_PAGO'");
    expect(total).toBe(0);
  });
});
