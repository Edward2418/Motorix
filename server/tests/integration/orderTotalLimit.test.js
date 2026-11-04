import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, addServiceLine, createPart } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';

afterAll(closePool);

const agregarLinea = (token, orderId, tipo, body) => request(app).post(`/api/orders/${orderId}/${tipo}`).set(bearer(token)).send(body);
const cambiarLinea = (token, orderId, tipo, lineId, body) =>
  request(app).put(`/api/orders/${orderId}/${tipo}/${lineId}`).set(bearer(token)).send(body);
const agregarPieza = (token, orderId, body) => request(app).post(`/api/orders/${orderId}/parts`).set(bearer(token)).send(body);
const cambiarPieza = (token, orderId, lineId, body) => request(app).put(`/api/orders/${orderId}/parts/${lineId}`).set(bearer(token)).send(body);
const detalle = (token, orderId) => request(app).get(`/api/orders/${orderId}`).set(bearer(token));

const stockDe = async (partId) => (await pool.query('SELECT stock FROM parts WHERE id = ?', [partId]))[0][0].stock;
const movimientosDe = async (partId) => (await pool.query('SELECT id FROM inventory_movements WHERE part_id = ?', [partId]))[0].length;
const totalesDe = async (orderId) => {
  const [[fila]] = await pool.query(
    `SELECT (SELECT COALESCE(SUM(cost), 0) FROM order_services WHERE order_id = ?) AS servicios,
            (SELECT COALESCE(SUM(amount), 0) FROM order_labor WHERE order_id = ?) AS mano_de_obra,
            (SELECT COALESCE(SUM(quantity * unit_price), 0) FROM order_parts WHERE order_id = ?) AS refacciones`,
    [orderId, orderId, orderId]
  );
  return Math.round((Number(fila.servicios) + Number(fila.mano_de_obra) + Number(fila.refacciones)) * 100);
};

const LIMITE_EN_CENTAVOS = 9999999999;

describe('límite del total de la orden: $99,999,999.99', () => {
  beforeEach(resetTables);

  test('un servicio o mano de obra que haría pasar el total se rechaza con 422 y la orden no cambia', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    expect((await agregarLinea(tokens.mecanico, orden.id, 'services', { description: 'Reconstrucción', amount: 99999990 })).status).toBe(201);

    const rechazada = await agregarLinea(tokens.mecanico, orden.id, 'labor', { description: 'Mano de obra', amount: 10 });
    expect(rechazada.status).toBe(422);
    expect(rechazada.body.error.code).toBe('ORDER_TOTAL_LIMIT_EXCEEDED');
    expect((await pool.query('SELECT id FROM order_labor WHERE order_id = ?', [orden.id]))[0]).toHaveLength(0);
    expect((await detalle(tokens.admin, orden.id)).body.data.total).toBe(99999990);

    // Exactamente el máximo sí se acepta.
    const exacta = await agregarLinea(tokens.mecanico, orden.id, 'labor', { description: 'Mano de obra', amount: 9.99 });
    expect(exacta.status).toBe(201);
    expect(exacta.body.data.total).toBe(99999999.99);
    expect(await totalesDe(orden.id)).toBe(LIMITE_EN_CENTAVOS);
  });

  test('una refacción que haría pasar el total se rechaza con 422 sin tocar líneas, stock ni movimientos', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    await addServiceLine(orden.id, 'Reconstrucción', 99999000);
    const cara = await createPart({ code: 'CAJ-01', stock: 10, salePrice: 1000 });
    const antesMovimientos = await movimientosDe(cara.id);

    const rechazada = await agregarPieza(tokens.mecanico, orden.id, { partId: cara.id, quantity: 1 });
    expect(rechazada.status).toBe(422);
    expect(rechazada.body.error.code).toBe('ORDER_TOTAL_LIMIT_EXCEEDED');
    expect(await stockDe(cara.id)).toBe(10);
    expect(await movimientosDe(cara.id)).toBe(antesMovimientos);
    expect((await pool.query('SELECT id FROM order_parts WHERE order_id = ?', [orden.id]))[0]).toHaveLength(0);

    const cabe = await createPart({ code: 'CAJ-02', stock: 10, salePrice: 999.99 });
    expect((await agregarPieza(tokens.mecanico, orden.id, { partId: cabe.id, quantity: 1 })).status).toBe(201);
    expect(await totalesDe(orden.id)).toBe(LIMITE_EN_CENTAVOS);
  });

  test('cambiar el importe de un servicio o la cantidad de una refacción por encima del máximo se rechaza con 422', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const alta = await agregarLinea(tokens.mecanico, orden.id, 'services', { description: 'Servicio', amount: 100 });
    const servicioId = alta.body.data.services[0].id;
    await addServiceLine(orden.id, 'Servicio grande', 99999700);
    const pieza = await createPart({ code: 'PIE-01', stock: 10, salePrice: 100 });
    const conPieza = await agregarPieza(tokens.mecanico, orden.id, { partId: pieza.id, quantity: 1 });
    expect(conPieza.status).toBe(201);
    // Total actual: 100 + 99,999,700 + 100 = 99,999,900.
    expect(conPieza.body.data.total).toBe(99999900);

    const servicio = await cambiarLinea(tokens.mecanico, orden.id, 'services', servicioId, { description: 'Servicio', amount: 99999999.99 });
    expect(servicio.status).toBe(422);
    expect(servicio.body.error.code).toBe('ORDER_TOTAL_LIMIT_EXCEEDED');
    expect((await pool.query('SELECT cost FROM order_services WHERE id = ?', [servicioId]))[0][0].cost).toBe('100.00');

    const lineId = conPieza.body.data.parts[0].id;
    const cantidad = await cambiarPieza(tokens.mecanico, orden.id, lineId, { quantity: 10 });
    expect(cantidad.status).toBe(422);
    expect(cantidad.body.error.code).toBe('ORDER_TOTAL_LIMIT_EXCEEDED');
    expect((await pool.query('SELECT quantity FROM order_parts WHERE id = ?', [lineId]))[0][0].quantity).toBe(1);
    expect(await stockDe(pieza.id)).toBe(9);
  });

  test('con solicitudes simultáneas la suma nunca supera el límite', async () => {
    for (let intento = 1; intento <= 4; intento += 1) {
      await resetTables();
      const { orden, tokens } = await escenarioOrden('EN_REPARACION');
      await addServiceLine(orden.id, 'Reconstrucción', 99999990);

      const [uno, dos] = await Promise.all([
        agregarLinea(tokens.mecanico, orden.id, 'labor', { description: 'Uno', amount: 6 }),
        agregarLinea(tokens.mecanico, orden.id, 'labor', { description: 'Dos', amount: 6 })
      ]);
      expect([uno.status, dos.status].sort()).toEqual([201, 422]);
      expect(await totalesDe(orden.id)).toBeLessThanOrEqual(LIMITE_EN_CENTAVOS);
    }
  });

  test('una orden terminada con una refacción de la administración también respeta el límite', async () => {
    const { orden, tokens } = await escenarioOrden('TERMINADO');
    await addServiceLine(orden.id, 'Reconstrucción', 99999950);
    const pieza = await createPart({ code: 'PIE-02', stock: 10, salePrice: 100 });
    const res = await agregarPieza(tokens.admin, orden.id, { partId: pieza.id, quantity: 1, reason: 'Corrección' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ORDER_TOTAL_LIMIT_EXCEEDED');
    expect((await pool.query('SELECT id FROM order_parts WHERE order_id = ?', [orden.id]))[0]).toHaveLength(0);
    expect(await stockDe(pieza.id)).toBe(10);
  });
});
