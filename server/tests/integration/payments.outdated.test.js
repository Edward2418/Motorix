import request from 'supertest';
import app from '../../app.js';
import { AppError } from '../../utils/AppError.js';
import { pool, resetTables, closePool, createPart, createPayment } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { createFakeGateway, installFakeGateway, uninstallFakeGateway } from '../helpers/fakeGateway.js';
import { escenarioPago, registrarPago, cancelarPago, listarPagos } from '../helpers/payments.js';

const MOTIVO = 'Corrección de la administración';
const actualizar = (token, paymentId) => request(app).post(`/api/payments/${paymentId}/refresh`).set(bearer(token));
const detalle = (token, orderId) => request(app).get(`/api/orders/${orderId}`).set(bearer(token));
const agregarPieza = (token, orderId, body) => request(app).post(`/api/orders/${orderId}/parts`).set(bearer(token)).send(body);

const totalAlCrear = async (paymentId) =>
  (await pool.query('SELECT order_total_at_creation AS total FROM payments WHERE id = ?', [paymentId]))[0][0].total;
const referenciaExterna = async (paymentId) =>
  (await pool.query('SELECT external_reference FROM payments WHERE id = ?', [paymentId]))[0][0].external_reference;

// Orden terminada con un servicio de $1,250 y un pago de Mercado Pago pendiente por el total. Después se agrega una
// refacción de $100 (la administración, con motivo), así que el total pasa a $1,350 y el pago queda desfasado.
async function ordenConPagoDesfasado({ cambiarElTotal = true } = {}) {
  const escenario = await escenarioPago({ status: 'TERMINADO', total: 1250 });
  const pago = await registrarPago(escenario.tokens.recepcion, escenario.orden.id, { amount: 1250, method: 'MERCADO_PAGO' });
  expect(pago.status).toBe(201);
  const pieza = await createPart({ code: 'FIL-01', stock: 10, purchasePrice: 50, salePrice: 100 });
  if (cambiarElTotal) {
    const alta = await agregarPieza(escenario.tokens.admin, escenario.orden.id, { partId: pieza.id, quantity: 1, reason: MOTIVO });
    expect(alta.status).toBe(201);
  }
  return { ...escenario, pago: pago.body.data.payment, pieza };
}

describe('pagos de Mercado Pago desfasados', () => {
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

  test('todo pago nuevo, de cualquier método, guarda el total vigente de la orden al crearse', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'TERMINADO', total: 1000 });
    const efectivo = await registrarPago(tokens.recepcion, orden.id, { amount: 300, method: 'EFECTIVO' });
    const mercadoPago = await registrarPago(tokens.recepcion, orden.id, { amount: 400, method: 'MERCADO_PAGO' });
    expect(Number(await totalAlCrear(efectivo.body.data.payment.id))).toBe(1000);
    expect(Number(await totalAlCrear(mercadoPago.body.data.payment.id))).toBe(1000);
    expect(efectivo.body.data.payment.totalAtCreation).toBe(1000);
    expect(mercadoPago.body.data.payment.totalAtCreation).toBe(1000);
  });

  test('un pago pendiente cuyo total de creación difiere del vigente aparece desfasado en el listado y en la orden', async () => {
    const { orden, tokens } = await ordenConPagoDesfasado();

    const pagos = await listarPagos(tokens.recepcion, orden.id);
    expect(pagos.body.data.payments).toHaveLength(1);
    expect(pagos.body.data.payments[0]).toMatchObject({ status: 'PENDIENTE', amount: 1250, totalAtCreation: 1250, outdated: true });
    expect(pagos.body.data.summary).toMatchObject({ total: 1350, hasOutdatedPending: true });

    for (const token of [tokens.recepcion, tokens.admin]) {
      const orden1 = await detalle(token, orden.id);
      expect(orden1.body.data.payment).toMatchObject({ total: 1350, hasOutdatedPending: true });
    }
  });

  test('el sistema no cambia ni cancela por su cuenta el pago desfasado', async () => {
    const { orden, tokens, pago } = await ordenConPagoDesfasado();
    const pagos = await listarPagos(tokens.recepcion, orden.id);
    expect(pagos.body.data.payments[0]).toMatchObject({ id: pago.id, status: 'PENDIENTE', amount: 1250 });
    expect(pagos.body.data.summary).toMatchObject({ reserved: 1250, available: 100 });
  });

  test('un pago parcial pendiente no está desfasado mientras el total no cambie', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'TERMINADO', total: 1000 });
    await registrarPago(tokens.recepcion, orden.id, { amount: 400, method: 'MERCADO_PAGO' });

    const pagos = await listarPagos(tokens.recepcion, orden.id);
    expect(pagos.body.data.payments[0]).toMatchObject({ amount: 400, totalAtCreation: 1000, outdated: false });
    expect(pagos.body.data.summary.hasOutdatedPending).toBe(false);
    expect((await detalle(tokens.recepcion, orden.id)).body.data.payment.hasOutdatedPending).toBe(false);
  });

  test('un pago anterior al sprint (sin total de creación) nunca se marca, y solo los pendientes de Mercado Pago pueden estarlo', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'TERMINADO', total: 1250 });
    await createPayment({ orderId: orden.id, amount: 500, method: 'MERCADO_PAGO', status: 'PENDIENTE', externalReference: 'mtx-viejo', orderTotalAtCreation: null });
    await createPayment({ orderId: orden.id, amount: 200, method: 'EFECTIVO', status: 'PAGADO', orderTotalAtCreation: 900 });
    await createPayment({ orderId: orden.id, amount: 100, method: 'TARJETA', status: 'CANCELADO', orderTotalAtCreation: 900 });
    // El total vigente cambia (1250 → 1350); solo se prueba el cálculo del desfase, por eso se inserta directo.
    await pool.query('INSERT INTO order_labor (order_id, description, amount) VALUES (?, ?, ?)', [orden.id, 'Extra', 100]);

    const pagos = await listarPagos(tokens.recepcion, orden.id);
    expect(pagos.body.data.payments.map((p) => p.outdated)).toEqual([false, false, false]);
    expect(pagos.body.data.summary.hasOutdatedPending).toBe(false);
  });

  test('cancelar el pago desfasado (recepción, con motivo) permite cobrar el total vigente', async () => {
    const { orden, tokens, pago } = await ordenConPagoDesfasado();

    // Mientras no se cancele, el importe reservado impide cobrar de más.
    const bloqueado = await registrarPago(tokens.recepcion, orden.id, { amount: 1350, method: 'EFECTIVO' });
    expect(bloqueado.status).toBe(409);
    expect(bloqueado.body.error.code).toBe('AMOUNT_EXCEEDS_BALANCE');

    const cancelacion = await cancelarPago(tokens.recepcion, pago.id, { reason: 'El total cambió' });
    expect(cancelacion.status).toBe(200);
    expect(cancelacion.body.data.payment).toMatchObject({ status: 'CANCELADO', outdated: false });
    expect(cancelacion.body.data.summary.hasOutdatedPending).toBe(false);

    const nuevo = await registrarPago(tokens.recepcion, orden.id, { amount: 1350, method: 'EFECTIVO' });
    expect(nuevo.status).toBe(201);
    expect(nuevo.body.data.summary).toMatchObject({ total: 1350, collected: 1350, status: 'PAGADA' });
    expect(nuevo.body.data.payment.totalAtCreation).toBe(1350);
  });

  test('la aprobación tardía deja el pago Pagado por su importe original, muestra la diferencia y no crea otro pago', async () => {
    const { orden, tokens, pago } = await ordenConPagoDesfasado();
    gateway.setResults(await referenciaExterna(pago.id), [{ id: 'mp-1', status: 'approved' }]);

    const res = await actualizar(tokens.recepcion, pago.id);
    expect(res.status).toBe(200);
    expect(res.body.data.payment).toMatchObject({ status: 'PAGADO', amount: 1250, outdated: false });
    expect(res.body.data.summary).toMatchObject({ total: 1350, collected: 1250, balance: 100, status: 'PARCIAL', hasOutdatedPending: false });

    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM payments WHERE order_id = ?', [orden.id]);
    expect(total).toBe(1);
  });

  test('si Mercado Pago no responde al consultar un pago desfasado responde 503 y el pago no cambia', async () => {
    const { orden, tokens, pago } = await ordenConPagoDesfasado();
    gateway.failNext(AppError.serviceUnavailable('Mercado Pago no está disponible en este momento.'));

    const res = await actualizar(tokens.recepcion, pago.id);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    const pagos = await listarPagos(tokens.recepcion, orden.id);
    expect(pagos.body.data.payments[0]).toMatchObject({ status: 'PENDIENTE', amount: 1250, outdated: true });
  });

  test('el mecánico nunca recibe datos de pago, tampoco el aviso de desfase', async () => {
    const { orden, tokens } = await ordenConPagoDesfasado();
    const res = await detalle(tokens.mecanico, orden.id);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/outdated|hasOutdatedPending|totalAtCreation/i);
    expect(res.body.data).not.toHaveProperty('payment');
  });
});
