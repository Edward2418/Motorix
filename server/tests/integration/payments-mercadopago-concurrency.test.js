import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, pool, createPayment } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { createFakeGateway, installFakeGateway, uninstallFakeGateway } from '../helpers/fakeGateway.js';
import { escenarioPago, cancelarPago, listarPagos } from '../helpers/payments.js';

const actualizar = (token, paymentId) => request(app).post(`/api/payments/${paymentId}/refresh`).set(bearer(token));

describe('concurrencia con pagos de Mercado Pago', () => {
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

  async function pagoPendiente(total = 1000, importe = 1000) {
    const escenario = await escenarioPago({ total });
    const pago = await createPayment({
      orderId: escenario.orden.id,
      amount: importe,
      method: 'MERCADO_PAGO',
      status: 'PENDIENTE',
      externalReference: 'mtx-concurrente',
      expiresAt: new Date(Date.now() + 3600000)
    });
    return { ...escenario, pago };
  }

  test('dos actualizaciones simultáneas de un pago ya aprobado producen una sola transición a PAGADO', async () => {
    const { orden, tokens, pago } = await pagoPendiente();
    gateway.setResults('mtx-concurrente', [{ id: 4321, status: 'approved' }]);
    const respuestas = await Promise.all([actualizar(tokens.recepcion, pago.id), actualizar(tokens.admin, pago.id)]);
    expect(respuestas.map((r) => r.status)).toEqual([200, 200]);
    expect(respuestas.every((r) => r.body.data.payment.status === 'PAGADO')).toBe(true);
    const [[{ cobrado }]] = await pool.query("SELECT SUM(amount) AS cobrado FROM payments WHERE order_id = ? AND status = 'PAGADO'", [orden.id]);
    expect(Number(cobrado)).toBe(1000);
    const lista = await listarPagos(tokens.admin, orden.id);
    expect(lista.body.data.summary).toMatchObject({ collected: 1000, status: 'PAGADA' });
  });

  test('una actualización y una cancelación simultáneas dejan un único estado final coherente', async () => {
    const { orden, tokens, pago } = await pagoPendiente();
    gateway.setResults('mtx-concurrente', [{ id: 11, status: 'approved' }]);
    const [refresco, cancelacion] = await Promise.all([
      actualizar(tokens.recepcion, pago.id),
      cancelarPago(tokens.admin, pago.id, { reason: 'Cancelación simultánea' })
    ]);
    const [[{ status }]] = await pool.query('SELECT status FROM payments WHERE id = ?', [pago.id]);
    expect(['PAGADO', 'CANCELADO']).toContain(status);
    if (status === 'PAGADO') {
      // Ganó la actualización; la cancelación llegó después y, como cobrado, solo administración puede: debe haber sido 200 o 409.
      expect([200, 409]).toContain(cancelacion.status);
    } else {
      expect(cancelacion.status).toBe(200);
      expect(refresco.status).toBe(200);
      // La actualización pudo responder antes o después de la cancelación: ambos estados son coherentes.
      expect(['PAGADO', 'CANCELADO']).toContain(refresco.body.data.payment.status);
    }
    const lista = await listarPagos(tokens.admin, orden.id);
    const cobrado = lista.body.data.summary.collected;
    expect(cobrado).toBe(status === 'PAGADO' ? 1000 : 0);
  });
});
