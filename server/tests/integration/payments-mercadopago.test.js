import request from 'supertest';
import app from '../../app.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { resetTables, closePool, pool, createPayment } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { createFakeGateway, installFakeGateway, uninstallFakeGateway } from '../helpers/fakeGateway.js';
import { escenarioPago, registrarPago, listarPagos, cancelarPago } from '../helpers/payments.js';

const actualizar = (token, paymentId) => request(app).post(`/api/payments/${paymentId}/refresh`).set(bearer(token));

async function crearPagoMercadoPago(tokens, orden, amount = 400) {
  const res = await registrarPago(tokens.recepcion, orden.id, { amount, method: 'MERCADO_PAGO' });
  const [[fila]] = await pool.query('SELECT * FROM payments WHERE id = ?', [res.body.data?.payment?.id ?? 0]);
  return { res, fila };
}

describe('pagos con Mercado Pago (pasarela falsa)', () => {
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

  test('crear el pago lo deja PENDIENTE con enlace, vigencia y referencia única, y reserva el importe', async () => {
    const { orden, tokens } = await escenarioPago({ total: 1000 });
    const { res, fila } = await crearPagoMercadoPago(tokens, orden, 400);
    expect(res.status).toBe(201);
    expect(res.body.data.payment).toMatchObject({ method: 'MERCADO_PAGO', status: 'PENDIENTE', amount: 400, paidAt: null });
    expect(res.body.data.payment.paymentLink).toMatch(/^https:\/\/sandbox\.mercadopago\.test\//);
    expect(res.body.data.summary).toMatchObject({ collected: 0, reserved: 400, available: 600, status: 'SIN_PAGO' });

    expect(fila.external_reference).toMatch(/^mtx-/);
    expect(fila.external_preference_id).toBe('pref-1');
    const horas = (new Date(fila.expires_at) - Date.now()) / 3600000;
    expect(horas).toBeGreaterThan(env.payments.paymentLinkHours - 0.1);
    expect(horas).toBeLessThan(env.payments.paymentLinkHours + 0.1);
    expect(gateway.calls[0].request).toMatchObject({ externalReference: fila.external_reference, amount: 400 });
  });

  test('sin pasarela habilitada responde 409 MERCADOPAGO_NOT_CONFIGURED y no crea nada', async () => {
    await installFakeGateway(createFakeGateway({ enabled: false }));
    const { orden, tokens } = await escenarioPago();
    const res = await registrarPago(tokens.recepcion, orden.id, { amount: 100, method: 'MERCADO_PAGO' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MERCADOPAGO_NOT_CONFIGURED');
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM payments');
    expect(total).toBe(0);
  });

  test('si el servicio falla responde 503 y no crea ningún pago', async () => {
    const { orden, tokens } = await escenarioPago();
    gateway.failNext(AppError.serviceUnavailable('Mercado Pago no está disponible en este momento.'));
    const res = await registrarPago(tokens.recepcion, orden.id, { amount: 100, method: 'MERCADO_PAGO' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM payments');
    expect(total).toBe(0);
  });

  test('un importe mayor al disponible responde 409 sin llamar al servicio', async () => {
    const { orden, tokens } = await escenarioPago({ total: 1000 });
    const res = await registrarPago(tokens.recepcion, orden.id, { amount: 1500, method: 'MERCADO_PAGO' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('AMOUNT_EXCEEDS_BALANCE');
    expect(gateway.calls).toHaveLength(0);
  });

  test('un pago pendiente reserva saldo: no se puede reservar dos veces el mismo importe', async () => {
    const { orden, tokens } = await escenarioPago({ total: 1000 });
    await crearPagoMercadoPago(tokens, orden, 700);
    const res = await registrarPago(tokens.recepcion, orden.id, { amount: 400, method: 'EFECTIVO' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('$300.00');
  });

  test('actualizar con un cobro aprobado deja el pago PAGADO y recalcula la orden', async () => {
    const { orden, tokens } = await escenarioPago({ total: 1000 });
    const { res, fila } = await crearPagoMercadoPago(tokens, orden, 1000);
    gateway.setResults(fila.external_reference, [{ id: 987654, status: 'approved' }]);
    const resultado = await actualizar(tokens.recepcion, res.body.data.payment.id);
    expect(resultado.status).toBe(200);
    expect(resultado.body.data.payment).toMatchObject({ status: 'PAGADO', paymentLink: null });
    expect(resultado.body.data.payment.paidAt).toEqual(expect.any(String));
    expect(resultado.body.data.warning ?? null).toBeNull();
    expect(resultado.body.data.summary).toMatchObject({ collected: 1000, reserved: 0, balance: 0, status: 'PAGADA' });
    const [[actual]] = await pool.query('SELECT external_payment_id FROM payments WHERE id = ?', [fila.id]);
    expect(actual.external_payment_id).toBe('987654');
  });

  test('actualizar con un cobro rechazado deja RECHAZADO y libera lo reservado', async () => {
    const { orden, tokens } = await escenarioPago({ total: 1000 });
    const { res, fila } = await crearPagoMercadoPago(tokens, orden, 600);
    gateway.setResults(fila.external_reference, [{ id: 1, status: 'rejected' }]);
    const resultado = await actualizar(tokens.admin, res.body.data.payment.id);
    expect(resultado.body.data.payment.status).toBe('RECHAZADO');
    expect(resultado.body.data.summary).toMatchObject({ reserved: 0, available: 1000, collected: 0 });
  });

  test('con el enlace vencido y sin cobros queda RECHAZADO', async () => {
    const { orden, tokens } = await escenarioPago({ total: 1000 });
    const pago = await createPayment({
      orderId: orden.id,
      amount: 300,
      method: 'MERCADO_PAGO',
      status: 'PENDIENTE',
      externalReference: 'mtx-vencido',
      expiresAt: new Date(Date.now() - 3600000)
    });
    const resultado = await actualizar(tokens.recepcion, pago.id);
    expect(resultado.status).toBe(200);
    expect(resultado.body.data.payment.status).toBe('RECHAZADO');
  });

  test('si el servicio aún no resuelve sigue PENDIENTE con el aviso STILL_PENDING', async () => {
    const { orden, tokens } = await escenarioPago();
    const { res } = await crearPagoMercadoPago(tokens, orden, 200);
    const resultado = await actualizar(tokens.recepcion, res.body.data.payment.id);
    expect(resultado.status).toBe(200);
    expect(resultado.body.data.payment.status).toBe('PENDIENTE');
    expect(resultado.body.data.warning).toBe('STILL_PENDING');
  });

  test('actualizar dos veces un pago ya resuelto no cambia nada ni duplica el cobro', async () => {
    const { orden, tokens } = await escenarioPago({ total: 1000 });
    const { res, fila } = await crearPagoMercadoPago(tokens, orden, 1000);
    gateway.setResults(fila.external_reference, [{ id: 5, status: 'approved' }]);
    await actualizar(tokens.recepcion, res.body.data.payment.id);
    const [[antes]] = await pool.query('SELECT paid_at, updated_at FROM payments WHERE id = ?', [fila.id]);
    const segunda = await actualizar(tokens.recepcion, res.body.data.payment.id);
    expect(segunda.status).toBe(200);
    expect(segunda.body.data.summary.collected).toBe(1000);
    const [[despues]] = await pool.query('SELECT paid_at FROM payments WHERE id = ?', [fila.id]);
    expect(new Date(despues.paid_at).getTime()).toBe(new Date(antes.paid_at).getTime());
    const lista = await listarPagos(tokens.recepcion, orden.id);
    expect(lista.body.data.payments).toHaveLength(1);
  });

  test('actualizar un pago que no es de Mercado Pago responde 409 PAYMENT_NOT_REFRESHABLE', async () => {
    const { orden, tokens } = await escenarioPago();
    const pago = await createPayment({ orderId: orden.id, amount: 100 });
    const res = await actualizar(tokens.recepcion, pago.id);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PAYMENT_NOT_REFRESHABLE');
  });

  test('un pago cancelado cuyo cobro aparece aprobado no cambia y avisa EXTERNAL_APPROVED', async () => {
    const { orden, tokens } = await escenarioPago({ total: 1000 });
    const { res, fila } = await crearPagoMercadoPago(tokens, orden, 500);
    await cancelarPago(tokens.recepcion, res.body.data.payment.id, { reason: 'El cliente se arrepintió' });
    gateway.setResults(fila.external_reference, [{ id: 31, status: 'approved' }]);
    const resultado = await actualizar(tokens.recepcion, res.body.data.payment.id);
    expect(resultado.status).toBe(200);
    expect(resultado.body.data.payment.status).toBe('CANCELADO');
    expect(resultado.body.data.warning).toBe('EXTERNAL_APPROVED');
    expect(resultado.body.data.summary.collected).toBe(0);
  });

  test('cancelar un pago pendiente de Mercado Pago libera lo reservado', async () => {
    const { orden, tokens } = await escenarioPago({ total: 1000 });
    const { res } = await crearPagoMercadoPago(tokens, orden, 400);
    const cancelado = await cancelarPago(tokens.recepcion, res.body.data.payment.id, { reason: 'Se pagó en efectivo' });
    expect(cancelado.status).toBe(200);
    expect(cancelado.body.data.summary).toMatchObject({ reserved: 0, available: 1000 });
  });

  test('el servicio caído al actualizar responde 503 y el pago sigue pendiente', async () => {
    const { orden, tokens } = await escenarioPago();
    const { res } = await crearPagoMercadoPago(tokens, orden, 200);
    gateway.failNext(AppError.serviceUnavailable('Mercado Pago no está disponible en este momento.'));
    const resultado = await actualizar(tokens.recepcion, res.body.data.payment.id);
    expect(resultado.status).toBe(503);
    const [[{ status }]] = await pool.query('SELECT status FROM payments WHERE id = ?', [res.body.data.payment.id]);
    expect(status).toBe('PENDIENTE');
  });

  test('un pago inexistente responde 404 y el mecánico recibe 403', async () => {
    const { orden, tokens } = await escenarioPago();
    const { res } = await crearPagoMercadoPago(tokens, orden, 100);
    expect((await actualizar(tokens.recepcion, 999999)).status).toBe(404);
    expect((await actualizar(tokens.mecanico, res.body.data.payment.id)).status).toBe(403);
    expect((await request(app).post(`/api/payments/${res.body.data.payment.id}/refresh`)).status).toBe(401);
  });

  test('GET /payments/config informa que Mercado Pago está habilitado', async () => {
    const { tokens } = await escenarioPago();
    const res = await request(app).get('/api/payments/config').set(bearer(tokens.recepcion));
    expect(res.body.data.mercadoPagoEnabled).toBe(true);
  });

  test('ninguna respuesta ni fila contiene credenciales ni datos internos del servicio', async () => {
    const { orden, tokens } = await escenarioPago({ total: 1000 });
    const { res, fila } = await crearPagoMercadoPago(tokens, orden, 400);
    const lista = await listarPagos(tokens.admin, orden.id);
    const texto = JSON.stringify([res.body, lista.body]);
    expect(texto).not.toMatch(/access_?token|bearer|APP_USR|TEST-/i);
    expect(texto).not.toContain(fila.external_reference);
    expect(texto).not.toContain('externalReference');
    const columnas = Object.keys(fila).join(',');
    expect(columnas).not.toMatch(/token|card|cvv|secret/i);
  });
});
