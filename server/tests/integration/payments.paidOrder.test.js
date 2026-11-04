import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createPart, createOrderPart, createPayment } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioPago, registrarPago, cancelarPago } from '../helpers/payments.js';

afterAll(closePool);

const MOTIVO = 'Corrección de la administración';
const agregar = (token, orderId, body) => request(app).post(`/api/orders/${orderId}/parts`).set(bearer(token)).send(body);
const cambiar = (token, orderId, lineId, body) => request(app).put(`/api/orders/${orderId}/parts/${lineId}`).set(bearer(token)).send(body);
const quitar = (token, orderId, lineId, body) => request(app).delete(`/api/orders/${orderId}/parts/${lineId}`).set(bearer(token)).send(body);

const stockDe = async (partId) => (await pool.query('SELECT stock FROM parts WHERE id = ?', [partId]))[0][0].stock;
const movimientos = async () => (await pool.query('SELECT COUNT(*) AS total FROM inventory_movements'))[0][0].total;
const lineas = async (orderId) => (await pool.query('SELECT part_id, quantity FROM order_parts WHERE order_id = ? ORDER BY id', [orderId]))[0];

// Orden terminada con un servicio de $1,000 y una refacción (2 × $100), ya cobrada por completo.
async function ordenCobrada(estado = 'TERMINADO') {
  const escenario = await escenarioPago({ status: estado, total: 1000 });
  const pieza = await createPart({ code: 'FIL-01', stock: 10, salePrice: 100 });
  const linea = await createOrderPart({ orderId: escenario.orden.id, partId: pieza.id, quantity: 2 });
  const otra = await createPart({ code: 'BUJ-01', stock: 10, salePrice: 50 });
  const cobro = await registrarPago(escenario.tokens.recepcion, escenario.orden.id, { amount: 1200, method: 'EFECTIVO' });
  expect(cobro.status).toBe(201);
  return { ...escenario, pieza, linea, otra, pago: cobro.body.data.payment };
}

describe('orden con un pago cobrado: no admite cambios de refacciones', () => {
  beforeEach(resetTables);

  test('agregar, sumar a la misma, cambiar la cantidad y quitar responden 409 ORDER_ALREADY_PAID sin tocar nada', async () => {
    const { orden, tokens, pieza, linea, otra } = await ordenCobrada();
    const stockAntes = { pieza: await stockDe(pieza.id), otra: await stockDe(otra.id) };
    const movimientosAntes = await movimientos();
    const lineasAntes = await lineas(orden.id);

    const respuestas = [
      await agregar(tokens.admin, orden.id, { partId: otra.id, quantity: 1, reason: MOTIVO }),
      await agregar(tokens.admin, orden.id, { partId: pieza.id, quantity: 1, reason: MOTIVO }),
      await cambiar(tokens.admin, orden.id, linea.id, { quantity: 3, reason: MOTIVO }),
      await quitar(tokens.admin, orden.id, linea.id, { reason: MOTIVO })
    ];
    for (const res of respuestas) {
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ORDER_ALREADY_PAID');
      expect(res.body.error.message).toBe('La orden ya está cobrada: no se pueden modificar las refacciones.');
    }
    expect({ pieza: await stockDe(pieza.id), otra: await stockDe(otra.id) }).toEqual(stockAntes);
    expect(await movimientos()).toBe(movimientosAntes);
    expect(await lineas(orden.id)).toEqual(lineasAntes);
  });

  test('un mecánico o recepción nunca reciben ORDER_ALREADY_PAID: no se les revela información de pagos', async () => {
    const terminada = await ordenCobrada('TERMINADO');
    const delMecanico = await agregar(terminada.tokens.mecanico, terminada.orden.id, { partId: terminada.otra.id, quantity: 1 });
    expect(delMecanico.status).toBe(403);
    expect(delMecanico.body.error.code).toBe('FORBIDDEN');
    const deRecepcion = await agregar(terminada.tokens.recepcion, terminada.orden.id, { partId: terminada.otra.id, quantity: 1 });
    expect(deRecepcion.status).toBe(403);
    expect(deRecepcion.body.error.code).toBe('FORBIDDEN');
  });

  test('en una orden entregada y cobrada el estado final se responde antes que la orden cobrada', async () => {
    await resetTables();
    const entregada = await ordenCobrada('ENTREGADO');
    for (const token of [entregada.tokens.mecanico, entregada.tokens.admin]) {
      const res = await agregar(token, entregada.orden.id, { partId: entregada.otra.id, quantity: 1, reason: MOTIVO });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    }
  });

  test('con solo un pago pendiente de Mercado Pago el administrador sí puede cambiar las refacciones', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'TERMINADO', total: 1000 });
    await createPayment({ orderId: orden.id, amount: 500, method: 'MERCADO_PAGO', status: 'PENDIENTE', externalReference: 'mtx-pendiente' });
    const pieza = await createPart({ code: 'FIL-01', stock: 10, salePrice: 100 });

    const res = await agregar(tokens.admin, orden.id, { partId: pieza.id, quantity: 1, reason: MOTIVO });
    expect(res.status).toBe(201);
    expect(await stockDe(pieza.id)).toBe(9);
  });

  test('si la administración cancela el pago cobrado, la orden vuelve a admitir cambios de refacciones', async () => {
    const { orden, tokens, otra, pago } = await ordenCobrada();
    expect((await agregar(tokens.admin, orden.id, { partId: otra.id, quantity: 1, reason: MOTIVO })).status).toBe(409);

    const cancelacion = await cancelarPago(tokens.admin, pago.id, { reason: 'Se cobró por error' });
    expect(cancelacion.status).toBe(200);
    const res = await agregar(tokens.admin, orden.id, { partId: otra.id, quantity: 1, reason: MOTIVO });
    expect(res.status).toBe(201);
  });
});

describe('cobrar y agregar una refacción al mismo tiempo', () => {
  test('las dos operaciones se ejecutan una tras otra y la segunda se evalúa con el resultado de la primera', async () => {
    const resultados = { cobroPrimero: 0, altaPrimero: 0 };
    for (let intento = 1; intento <= 8; intento += 1) {
      await resetTables();
      const { orden, tokens } = await escenarioPago({ status: 'TERMINADO', total: 1000 });
      const pieza = await createPart({ code: 'BUJ-01', stock: 10, salePrice: 100 });

      const [cobro, alta] = await Promise.all([
        registrarPago(tokens.recepcion, orden.id, { amount: 1000, method: 'EFECTIVO' }),
        agregar(tokens.admin, orden.id, { partId: pieza.id, quantity: 1, reason: MOTIVO })
      ]);
      expect(cobro.status).toBe(201);

      const [[resumen]] = await pool.query(
        `SELECT (SELECT COALESCE(SUM(s.cost), 0) FROM order_services s WHERE s.order_id = ?)
              + (SELECT COALESCE(SUM(p.quantity * p.unit_price), 0) FROM order_parts p WHERE p.order_id = ?) AS total`,
        [orden.id, orden.id]
      );
      if (alta.status === 409) {
        // El cobro fue primero: la refacción se rechazó y el pago cubre todo el total.
        expect(alta.body.error.code).toBe('ORDER_ALREADY_PAID');
        expect(await lineas(orden.id)).toEqual([]);
        expect(await stockDe(pieza.id)).toBe(10);
        expect(Number(resumen.total)).toBe(1000);
        resultados.cobroPrimero += 1;
      } else {
        // El alta fue primero: el cobro se calculó con el total nuevo y el pago de 1000 deja la orden en pago parcial.
        expect(alta.status).toBe(201);
        expect(Number(resumen.total)).toBe(1100);
        expect(cobro.body.data.summary).toMatchObject({ total: 1100, collected: 1000, status: 'PARCIAL' });
        resultados.altaPrimero += 1;
      }
    }
    expect(resultados.cobroPrimero + resultados.altaPrimero).toBe(8);
  });
});
