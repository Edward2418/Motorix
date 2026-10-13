import { resetTables, closePool, pool, createPayment } from '../helpers/db.js';
import { escenarioPago, cancelarPago, listarPagos } from '../helpers/payments.js';

describe('cancelación de pagos', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('recepción cancela un pago pendiente con motivo y libera lo reservado', async () => {
    const { orden, tokens } = await escenarioPago({ total: 1000 });
    const pago = await createPayment({ orderId: orden.id, amount: 400, status: 'PENDIENTE', method: 'MERCADO_PAGO' });
    const antes = await listarPagos(tokens.recepcion, orden.id);
    expect(antes.body.data.summary).toMatchObject({ reserved: 400, available: 600 });

    const res = await cancelarPago(tokens.recepcion, pago.id, { reason: 'El cliente prefirió pagar en efectivo' });
    expect(res.status).toBe(200);
    expect(res.body.data.payment).toMatchObject({
      status: 'CANCELADO',
      cancelReason: 'El cliente prefirió pagar en efectivo',
      cancelledByName: expect.any(String)
    });
    expect(res.body.data.summary).toMatchObject({ reserved: 0, available: 1000 });
    const [[fila]] = await pool.query('SELECT cancelled_by, cancelled_at FROM payments WHERE id = ?', [pago.id]);
    expect(fila.cancelled_by).toEqual(expect.any(Number));
    expect(fila.cancelled_at).not.toBeNull();
  });

  test('recepción no puede cancelar un pago cobrado', async () => {
    const { orden, tokens } = await escenarioPago();
    const pago = await createPayment({ orderId: orden.id, amount: 100, status: 'PAGADO' });
    const res = await cancelarPago(tokens.recepcion, pago.id, { reason: 'Error de captura' });
    expect(res.status).toBe(403);
    const [[{ status }]] = await pool.query('SELECT status FROM payments WHERE id = ?', [pago.id]);
    expect(status).toBe('PAGADO');
  });

  test('administración cancela un pago cobrado y la orden vuelve a tener saldo', async () => {
    const { orden, tokens } = await escenarioPago({ total: 1000 });
    const pago = await createPayment({ orderId: orden.id, amount: 1000, status: 'PAGADO' });
    const res = await cancelarPago(tokens.admin, pago.id, { reason: 'Error de captura' });
    expect(res.status).toBe(200);
    expect(res.body.data.summary).toMatchObject({ collected: 0, balance: 1000, available: 1000, status: 'SIN_PAGO' });
  });

  test('sin motivo responde 400', async () => {
    const { orden, tokens } = await escenarioPago();
    const pago = await createPayment({ orderId: orden.id, amount: 100, status: 'PENDIENTE', method: 'MERCADO_PAGO' });
    for (const body of [{}, { reason: '' }, { reason: '   ' }]) {
      expect((await cancelarPago(tokens.admin, pago.id, body)).status).toBe(400);
    }
  });

  test('un pago rechazado o cancelado no cambia: 409 PAYMENT_NOT_CANCELLABLE', async () => {
    const { orden, tokens } = await escenarioPago();
    const rechazado = await createPayment({ orderId: orden.id, amount: 50, status: 'RECHAZADO', method: 'MERCADO_PAGO' });
    const cancelado = await createPayment({ orderId: orden.id, amount: 50, status: 'CANCELADO' });
    for (const pago of [rechazado, cancelado]) {
      const res = await cancelarPago(tokens.admin, pago.id, { reason: 'Prueba' });
      expect({ id: pago.id, status: res.status, code: res.body.error?.code }).toEqual({
        id: pago.id,
        status: 409,
        code: 'PAYMENT_NOT_CANCELLABLE'
      });
    }
  });

  test('un pago inexistente responde 404', async () => {
    const { tokens } = await escenarioPago();
    expect((await cancelarPago(tokens.admin, 999999, { reason: 'Prueba' })).status).toBe(404);
  });

  test('el pago cancelado se conserva en el historial y ya no cuenta', async () => {
    const { orden, tokens } = await escenarioPago({ total: 1000 });
    const pago = await createPayment({ orderId: orden.id, amount: 300, status: 'PAGADO' });
    await cancelarPago(tokens.admin, pago.id, { reason: 'Duplicado' });
    const lista = await listarPagos(tokens.admin, orden.id);
    expect(lista.body.data.payments).toHaveLength(1);
    expect(lista.body.data.payments[0].status).toBe('CANCELADO');
    expect(lista.body.data.summary.collected).toBe(0);
  });

  test('dos cancelaciones simultáneas del mismo pago: una responde 200 y la otra 409', async () => {
    const { orden, tokens } = await escenarioPago();
    const pago = await createPayment({ orderId: orden.id, amount: 100, status: 'PENDIENTE', method: 'MERCADO_PAGO' });
    const respuestas = await Promise.all([
      cancelarPago(tokens.recepcion, pago.id, { reason: 'Primera' }),
      cancelarPago(tokens.admin, pago.id, { reason: 'Segunda' })
    ]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409]);
  });
});
