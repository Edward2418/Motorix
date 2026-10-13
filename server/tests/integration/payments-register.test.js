import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, pool, addServiceLine, createPart, createOrderPart, createPayment } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioPago, registrarPago, listarPagos } from '../helpers/payments.js';

describe('registro de pagos de una orden', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('un pago total en efectivo deja la orden PAGADA con saldo cero', async () => {
    const { orden, tokens } = await escenarioPago({ total: 1000 });
    const res = await registrarPago(tokens.recepcion, orden.id, { amount: 1000, method: 'EFECTIVO' });
    expect(res.status).toBe(201);
    expect(res.body.data.payment).toMatchObject({ orderId: orden.id, amount: 1000, method: 'EFECTIVO', status: 'PAGADO' });
    expect(res.body.data.payment.paidAt).toEqual(expect.any(String));
    expect(res.body.data.summary).toMatchObject({ total: 1000, collected: 1000, balance: 0, available: 0, status: 'PAGADA' });

    const [[fila]] = await pool.query('SELECT created_by, paid_at FROM payments WHERE id = ?', [res.body.data.payment.id]);
    expect(fila.created_by).toEqual(expect.any(Number));
    expect(fila.paid_at).not.toBeNull();
  });

  test('el pago parcial deja PARCIAL y un segundo pago por el resto deja PAGADA', async () => {
    const { orden, tokens } = await escenarioPago({ total: 1000 });
    const primero = await registrarPago(tokens.recepcion, orden.id, { amount: 400, method: 'TRANSFERENCIA' });
    expect(primero.body.data.summary).toMatchObject({ collected: 400, balance: 600, available: 600, status: 'PARCIAL' });
    const segundo = await registrarPago(tokens.admin, orden.id, { amount: 600, method: 'TARJETA' });
    expect(segundo.status).toBe(201);
    expect(segundo.body.data.summary).toMatchObject({ collected: 1000, balance: 0, status: 'PAGADA' });
  });

  test('un importe mayor al disponible responde 409 con el disponible y no cambia nada', async () => {
    const { orden, tokens } = await escenarioPago({ total: 1000 });
    await registrarPago(tokens.recepcion, orden.id, { amount: 300, method: 'EFECTIVO' });
    const res = await registrarPago(tokens.recepcion, orden.id, { amount: 800, method: 'EFECTIVO' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('AMOUNT_EXCEEDS_BALANCE');
    expect(res.body.error.message).toContain('$700.00');
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM payments WHERE order_id = ?', [orden.id]);
    expect(total).toBe(1);
  });

  test('los importes en cero, negativos, con tres decimales o texto responden 400', async () => {
    const { orden, tokens } = await escenarioPago();
    for (const amount of [0, -10, 10.123, '100', null]) {
      const res = await registrarPago(tokens.recepcion, orden.id, { amount, method: 'EFECTIVO' });
      expect({ amount, status: res.status, code: res.body.error?.code }).toEqual({ amount, status: 400, code: 'VALIDATION_ERROR' });
    }
  });

  test('una orden abierta o cancelada responde 409 ORDER_NOT_PAYABLE', async () => {
    for (const status of ['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION', 'CANCELADA']) {
      await resetTables();
      const { orden, tokens } = await escenarioPago({ status });
      const res = await registrarPago(tokens.recepcion, orden.id, { amount: 100, method: 'EFECTIVO' });
      expect({ status, http: res.status, code: res.body.error?.code }).toEqual({ status, http: 409, code: 'ORDER_NOT_PAYABLE' });
    }
  });

  test('una orden ENTREGADA con saldo sigue aceptando pagos', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'ENTREGADO', total: 500 });
    const res = await registrarPago(tokens.recepcion, orden.id, { amount: 500, method: 'EFECTIVO' });
    expect(res.status).toBe(201);
    expect(res.body.data.summary.status).toBe('PAGADA');
  });

  test('una orden con total cero responde 409 ORDER_NOT_PAYABLE', async () => {
    const { orden, tokens } = await escenarioPago({ total: 0 });
    const res = await registrarPago(tokens.recepcion, orden.id, { amount: 50, method: 'EFECTIVO' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ORDER_NOT_PAYABLE');
    expect(res.body.error.message).toMatch(/no tiene importe por cobrar/i);
  });

  test('una orden inexistente responde 404', async () => {
    const { tokens } = await escenarioPago();
    const res = await registrarPago(tokens.recepcion, 999999, { amount: 50, method: 'EFECTIVO' });
    expect(res.status).toBe(404);
  });

  test('el total de la orden incluye las refacciones', async () => {
    const { orden, tokens } = await escenarioPago({ total: 1000 });
    const pieza = await createPart({ code: 'REF-PAGO', stock: 5, salePrice: 250 });
    await createOrderPart({ orderId: orden.id, partId: pieza.id, quantity: 2 });
    const res = await registrarPago(tokens.recepcion, orden.id, { amount: 1500, method: 'EFECTIVO' });
    expect(res.status).toBe(201);
    expect(res.body.data.summary).toMatchObject({ total: 1500, status: 'PAGADA' });
  });

  test('si el total baja después de cobrar aparece el saldo a favor y no se admiten más pagos', async () => {
    const { orden, tokens } = await escenarioPago({ total: 1000 });
    await registrarPago(tokens.recepcion, orden.id, { amount: 1000, method: 'EFECTIVO' });
    await pool.query('UPDATE order_services SET cost = 700 WHERE order_id = ?', [orden.id]);
    const lista = await listarPagos(tokens.recepcion, orden.id);
    expect(lista.body.data.summary).toMatchObject({ total: 700, collected: 1000, balance: 0, creditBalance: 300, status: 'PAGADA' });
    const extra = await registrarPago(tokens.recepcion, orden.id, { amount: 10, method: 'EFECTIVO' });
    expect(extra.status).toBe(409);
    expect(extra.body.error.code).toBe('AMOUNT_EXCEEDS_BALANCE');
  });

  test('si el total sube después de cobrar queda saldo por cobrar', async () => {
    const { orden, tokens } = await escenarioPago({ total: 1000 });
    await registrarPago(tokens.recepcion, orden.id, { amount: 1000, method: 'EFECTIVO' });
    await addServiceLine(orden.id, 'Servicio extra', 200);
    const lista = await listarPagos(tokens.recepcion, orden.id);
    expect(lista.body.data.summary).toMatchObject({ total: 1200, balance: 200, available: 200, status: 'PARCIAL' });
  });

  test('el listado trae todos los pagos, también los cancelados, del más reciente al más antiguo', async () => {
    const { orden, tokens } = await escenarioPago({ total: 1000 });
    const a = await createPayment({ orderId: orden.id, amount: 100, status: 'PAGADO' });
    const b = await createPayment({ orderId: orden.id, amount: 200, status: 'CANCELADO' });
    const c = await createPayment({ orderId: orden.id, amount: 300, status: 'RECHAZADO', method: 'MERCADO_PAGO' });
    const res = await listarPagos(tokens.recepcion, orden.id);
    expect(res.status).toBe(200);
    expect(res.body.data.payments.map((p) => p.id)).toEqual([c.id, b.id, a.id]);
    expect(res.body.data.payments[0]).toMatchObject({ orderFolio: orden.folio, createdByName: expect.any(String) });
    expect(res.body.data.summary).toMatchObject({ collected: 100, available: 900 });
  });

  test('los cuerpos con campos de tarjeta no los guardan ni los devuelven', async () => {
    const { orden, tokens } = await escenarioPago();
    const res = await registrarPago(tokens.recepcion, orden.id, {
      amount: 100,
      method: 'TARJETA',
      cardNumber: '4111111111111111',
      cvv: '123'
    });
    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toMatch(/4111|cvv|cardNumber/i);
    const [columnas] = await pool.query("SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'payments'");
    expect(columnas.map((c) => c.COLUMN_NAME.toLowerCase()).join(',')).not.toMatch(/card|cvv|pan|token/);
  });

  test('el detalle de la orden refleja el resumen de pagos', async () => {
    const { orden, tokens } = await escenarioPago({ total: 1000 });
    await registrarPago(tokens.recepcion, orden.id, { amount: 250, method: 'EFECTIVO' });
    const detalle = await request(app).get(`/api/orders/${orden.id}`).set(bearer(tokens.recepcion));
    expect(detalle.body.data.payment).toMatchObject({ total: 1000, collected: 250, balance: 750, status: 'PARCIAL' });
    const lista = await request(app).get('/api/orders').set(bearer(tokens.recepcion));
    expect(lista.body.data[0].paymentStatus).toBe('PARCIAL');
  });
});
