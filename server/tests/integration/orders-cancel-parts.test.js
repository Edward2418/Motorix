import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createPart } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';

afterAll(closePool);

const agregar = (token, orderId, body) => request(app).post(`/api/orders/${orderId}/parts`).set(bearer(token)).send(body);
const cancelar = (token, orderId) =>
  request(app).post(`/api/orders/${orderId}/status`).set(bearer(token)).send({ status: 'CANCELADA', reason: 'El cliente se arrepintió' });

const stockDe = async (partId) => (await pool.query('SELECT stock FROM parts WHERE id = ?', [partId]))[0][0].stock;
const movimientosDe = async (partId) =>
  (await pool.query('SELECT type, quantity, stock_after, reason, order_id FROM inventory_movements WHERE part_id = ? ORDER BY id', [partId]))[0];

describe('cancelar una orden con refacciones', () => {
  beforeEach(resetTables);

  test('devuelve cada refacción al inventario con una entrada de devolución y conserva las líneas', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const bujias = await createPart({ code: 'BUJ-01', stock: 10 });
    const filtro = await createPart({ code: 'FIL-01', name: 'Filtro', stock: 6 });
    await agregar(tokens.mecanico, orden.id, { partId: bujias.id, quantity: 4 });
    await agregar(tokens.mecanico, orden.id, { partId: filtro.id, quantity: 1 });
    expect(await stockDe(bujias.id)).toBe(6);

    const res = await cancelar(tokens.recepcion, orden.id);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELADA');
    expect(await stockDe(bujias.id)).toBe(10);
    expect(await stockDe(filtro.id)).toBe(6);

    const movimientos = await movimientosDe(bujias.id);
    expect(movimientos.map((m) => [m.type, m.quantity])).toEqual([['ENTRADA', 10], ['SALIDA', -4], ['ENTRADA', 4]]);
    expect(movimientos[2].reason).toContain('cancelación');
    expect(movimientos[2].reason).toContain(orden.folio);
    expect(movimientos[2].order_id).toBe(orden.id);

    const detalle = await request(app).get(`/api/orders/${orden.id}`).set(bearer(tokens.admin));
    expect(detalle.body.data.parts).toHaveLength(2);
  });

  test('reintentar la cancelación responde 409 y no devuelve las unidades una segunda vez', async () => {
    const { orden, tokens } = await escenarioOrden('DIAGNOSTICO');
    const pieza = await createPart({ code: 'BUJ-01', stock: 10 });
    await agregar(tokens.mecanico, orden.id, { partId: pieza.id, quantity: 4 });

    expect((await cancelar(tokens.recepcion, orden.id)).status).toBe(200);
    const segunda = await cancelar(tokens.admin, orden.id);
    expect(segunda.status).toBe(409);
    expect(await stockDe(pieza.id)).toBe(10);
    expect(await movimientosDe(pieza.id)).toHaveLength(3);
  });

  test('dos cancelaciones simultáneas devuelven las unidades una sola vez', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const pieza = await createPart({ code: 'BUJ-01', stock: 10 });
    await agregar(tokens.mecanico, orden.id, { partId: pieza.id, quantity: 4 });

    const [a, b] = await Promise.all([cancelar(tokens.recepcion, orden.id), cancelar(tokens.admin, orden.id)]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await stockDe(pieza.id)).toBe(10);
    expect((await movimientosDe(pieza.id)).filter((m) => m.type === 'ENTRADA')).toHaveLength(2);
  });

  test('una orden sin refacciones se cancela sin generar movimientos', async () => {
    const { orden, tokens } = await escenarioOrden('RECIBIDO');
    const pieza = await createPart({ code: 'BUJ-01', stock: 10 });
    expect((await cancelar(tokens.recepcion, orden.id)).status).toBe(200);
    expect(await movimientosDe(pieza.id)).toHaveLength(1);
  });

  test('si la devolución falla, la orden no cambia de estado', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const pieza = await createPart({ code: 'BUJ-01', stock: 10 });
    await agregar(tokens.mecanico, orden.id, { partId: pieza.id, quantity: 4 });
    // Con el stock en el máximo, devolver las unidades superaría el límite y la transacción completa se revierte.
    await pool.query('UPDATE parts SET stock = 99999999 WHERE id = ?', [pieza.id]);

    const res = await cancelar(tokens.recepcion, orden.id);
    expect(res.status).toBeGreaterThanOrEqual(400);
    const estado = (await pool.query('SELECT status FROM service_orders WHERE id = ?', [orden.id]))[0][0].status;
    expect(estado).toBe('EN_REPARACION');
    expect(await stockDe(pieza.id)).toBe(99999999);
  });
});
