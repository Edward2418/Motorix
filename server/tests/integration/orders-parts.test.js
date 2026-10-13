import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createPart, addServiceLine } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';

afterAll(closePool);

const agregar = (token, orderId, body) => request(app).post(`/api/orders/${orderId}/parts`).set(bearer(token)).send(body);
const cambiar = (token, orderId, lineId, body) => request(app).put(`/api/orders/${orderId}/parts/${lineId}`).set(bearer(token)).send(body);
const quitar = (token, orderId, lineId, body) => request(app).delete(`/api/orders/${orderId}/parts/${lineId}`).set(bearer(token)).send(body);

const stockDe = async (partId) => (await pool.query('SELECT stock FROM parts WHERE id = ?', [partId]))[0][0].stock;
const movimientosDe = async (partId) =>
  (await pool.query('SELECT type, quantity, stock_after, reason, order_id FROM inventory_movements WHERE part_id = ? ORDER BY id', [partId]))[0];
const lineasDe = async (orderId) => (await pool.query('SELECT part_id, quantity, unit_price FROM order_parts WHERE order_id = ?', [orderId]))[0];

describe('refacciones en las órdenes', () => {
  beforeEach(resetTables);

  test('agregar copia el precio de venta, baja el stock, registra la salida ligada a la orden y suma al total', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    await addServiceLine(orden.id, 'Afinación', 500);
    const pieza = await createPart({ code: 'BUJ-01', stock: 10, salePrice: 80.5 });

    const res = await agregar(tokens.mecanico, orden.id, { partId: pieza.id, quantity: 3 });
    expect(res.status).toBe(201);
    expect(res.body.data.parts).toEqual([
      expect.objectContaining({ partId: pieza.id, code: 'BUJ-01', quantity: 3, unitPrice: 80.5, subtotal: 241.5 })
    ]);
    expect(res.body.data).toMatchObject({ partsTotal: 241.5, total: 741.5 });

    expect(await stockDe(pieza.id)).toBe(7);
    const movimientos = await movimientosDe(pieza.id);
    expect(movimientos[1]).toMatchObject({ type: 'SALIDA', quantity: -3, stock_after: 7, order_id: orden.id });
    expect(movimientos[1].reason).toContain(orden.folio);
  });

  test('una cantidad mayor al stock se rechaza con la existencia disponible y sin cambios', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const pieza = await createPart({ code: 'BUJ-01', stock: 4 });

    const res = await agregar(tokens.mecanico, orden.id, { partId: pieza.id, quantity: 5 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(res.body.error.message).toContain('disponible 4 unidades');
    expect(await stockDe(pieza.id)).toBe(4);
    expect(await lineasDe(orden.id)).toEqual([]);
    expect(await movimientosDe(pieza.id)).toHaveLength(1);
  });

  test('se puede usar exactamente todo el stock y la refacción queda agotada', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const pieza = await createPart({ code: 'BUJ-01', stock: 4 });
    expect((await agregar(tokens.mecanico, orden.id, { partId: pieza.id, quantity: 4 })).status).toBe(201);
    expect(await stockDe(pieza.id)).toBe(0);
  });

  test('cantidades en cero, negativas, decimales o texto se rechazan con 400', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const pieza = await createPart({ code: 'BUJ-01', stock: 10 });
    for (const quantity of [0, -1, 1.5, '2', null]) {
      const res = await agregar(tokens.mecanico, orden.id, { partId: pieza.id, quantity });
      expect({ quantity, status: res.status }).toEqual({ quantity, status: 400 });
    }
    expect(await stockDe(pieza.id)).toBe(10);
  });

  test('una refacción desactivada se rechaza con 409 y una inexistente con 404', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const inactiva = await createPart({ code: 'INA-01', stock: 5, active: false });
    const res = await agregar(tokens.mecanico, orden.id, { partId: inactiva.id, quantity: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PART_INACTIVE');
    expect((await agregar(tokens.mecanico, orden.id, { partId: 99999, quantity: 1 })).status).toBe(404);
    expect(await stockDe(inactiva.id)).toBe(5);
  });

  test('agregar dos veces la misma refacción se rechaza: se edita la cantidad', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const pieza = await createPart({ code: 'BUJ-01', stock: 10 });
    await agregar(tokens.mecanico, orden.id, { partId: pieza.id, quantity: 2 });
    const res = await agregar(tokens.mecanico, orden.id, { partId: pieza.id, quantity: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PART_ALREADY_IN_ORDER');
    expect(await stockDe(pieza.id)).toBe(8);
  });

  test('aumentar la cantidad registra una salida por la diferencia y reducirla una entrada de devolución', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const pieza = await createPart({ code: 'BUJ-01', stock: 10 });
    const alta = await agregar(tokens.mecanico, orden.id, { partId: pieza.id, quantity: 2 });
    const lineId = alta.body.data.parts[0].id;

    const sube = await cambiar(tokens.mecanico, orden.id, lineId, { quantity: 5 });
    expect(sube.status).toBe(200);
    expect(await stockDe(pieza.id)).toBe(5);

    const baja = await cambiar(tokens.mecanico, orden.id, lineId, { quantity: 1 });
    expect(baja.status).toBe(200);
    expect(await stockDe(pieza.id)).toBe(9);

    const movimientos = await movimientosDe(pieza.id);
    expect(movimientos.map((m) => [m.type, m.quantity])).toEqual([
      ['ENTRADA', 10],
      ['SALIDA', -2],
      ['SALIDA', -3],
      ['ENTRADA', 4]
    ]);
    expect(movimientos[3].reason).toMatch(/devoluci/i);
    expect(movimientos[3].order_id).toBe(orden.id);
  });

  test('cambiar a la misma cantidad no genera movimientos', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const pieza = await createPart({ code: 'BUJ-01', stock: 10 });
    const alta = await agregar(tokens.mecanico, orden.id, { partId: pieza.id, quantity: 2 });
    const res = await cambiar(tokens.mecanico, orden.id, alta.body.data.parts[0].id, { quantity: 2 });
    expect(res.status).toBe(200);
    expect(await movimientosDe(pieza.id)).toHaveLength(2);
  });

  test('aumentar por encima del stock se rechaza sin cambios parciales', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const pieza = await createPart({ code: 'BUJ-01', stock: 5 });
    const alta = await agregar(tokens.mecanico, orden.id, { partId: pieza.id, quantity: 3 });
    const res = await cambiar(tokens.mecanico, orden.id, alta.body.data.parts[0].id, { quantity: 9 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(await stockDe(pieza.id)).toBe(2);
    expect((await lineasDe(orden.id))[0].quantity).toBe(3);
  });

  test('quitar la refacción devuelve las unidades con una entrada y conserva la salida original', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const pieza = await createPart({ code: 'BUJ-01', stock: 10 });
    const alta = await agregar(tokens.mecanico, orden.id, { partId: pieza.id, quantity: 4 });

    const res = await quitar(tokens.mecanico, orden.id, alta.body.data.parts[0].id);
    expect(res.status).toBe(200);
    expect(res.body.data.parts).toEqual([]);
    expect(await stockDe(pieza.id)).toBe(10);
    expect(await lineasDe(orden.id)).toEqual([]);
    const movimientos = await movimientosDe(pieza.id);
    expect(movimientos.map((m) => [m.type, m.quantity])).toEqual([['ENTRADA', 10], ['SALIDA', -4], ['ENTRADA', 4]]);
  });

  test('cambiar el precio de venta del catálogo no altera las líneas ni el total de órdenes existentes', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const pieza = await createPart({ code: 'BUJ-01', stock: 10, salePrice: 100 });
    await agregar(tokens.mecanico, orden.id, { partId: pieza.id, quantity: 2 });

    await request(app).put(`/api/parts/${pieza.id}`).set(bearer(tokens.admin)).send({ salePrice: 250 });
    const detalle = await request(app).get(`/api/orders/${orden.id}`).set(bearer(tokens.admin));
    expect(detalle.body.data.parts[0]).toMatchObject({ unitPrice: 100, subtotal: 200 });
    expect(detalle.body.data.total).toBe(200);
  });

  test('el detalle y el listado de órdenes incluyen las refacciones en el total', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    await addServiceLine(orden.id, 'Afinación', 300);
    await addServiceLine(orden.id, 'Mano de obra', 150, 'order_labor');
    const pieza = await createPart({ code: 'BUJ-01', stock: 10, salePrice: 60 });
    await agregar(tokens.mecanico, orden.id, { partId: pieza.id, quantity: 2 });

    const detalle = await request(app).get(`/api/orders/${orden.id}`).set(bearer(tokens.mecanico));
    expect(detalle.body.data).toMatchObject({ servicesTotal: 300, laborTotal: 150, partsTotal: 120, total: 570 });
    const lista = await request(app).get('/api/orders').set(bearer(tokens.admin));
    expect(lista.body.data[0].total).toBe(570);
  });

  for (const estado of ['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION']) {
    test(`en ${estado} el mecánico asignado y el administrador pueden agregar; el ajeno y recepción no`, async () => {
      const { orden, tokens } = await escenarioOrden(estado);
      const pieza = await createPart({ code: 'BUJ-01', stock: 20 });
      expect((await agregar(tokens.otro, orden.id, { partId: pieza.id, quantity: 1 })).status).toBe(403);
      expect((await agregar(tokens.recepcion, orden.id, { partId: pieza.id, quantity: 1 })).status).toBe(403);
      expect((await agregar(tokens.mecanico, orden.id, { partId: pieza.id, quantity: 1 })).status).toBe(201);
      const otra = await createPart({ code: 'BUJ-02', stock: 20 });
      expect((await agregar(tokens.admin, orden.id, { partId: otra.id, quantity: 1 })).status).toBe(201);
    });
  }

  test('el mecánico ajeno y recepción tampoco pueden cambiar ni quitar líneas', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const pieza = await createPart({ code: 'BUJ-01', stock: 20 });
    const alta = await agregar(tokens.mecanico, orden.id, { partId: pieza.id, quantity: 2 });
    const lineId = alta.body.data.parts[0].id;
    for (const rol of ['otro', 'recepcion']) {
      expect({ rol, status: (await cambiar(tokens[rol], orden.id, lineId, { quantity: 3 })).status }).toEqual({ rol, status: 403 });
      expect({ rol, status: (await quitar(tokens[rol], orden.id, lineId)).status }).toEqual({ rol, status: 403 });
    }
    expect(await stockDe(pieza.id)).toBe(18);
  });

  test('en TERMINADO el mecánico (aunque sea el asignado) y recepción reciben 403', async () => {
    const { orden, tokens } = await escenarioOrden('TERMINADO');
    const pieza = await createPart({ code: 'BUJ-01', stock: 20 });
    for (const rol of ['mecanico', 'recepcion', 'otro']) {
      const res = await agregar(tokens[rol], orden.id, { partId: pieza.id, quantity: 1, reason: 'Faltó registrarla' });
      expect({ rol, status: res.status }).toEqual({ rol, status: 403 });
    }
    expect(await stockDe(pieza.id)).toBe(20);
  });

  test('en TERMINADO el administrador necesita un motivo y este queda en el movimiento', async () => {
    const { orden, tokens } = await escenarioOrden('TERMINADO');
    const pieza = await createPart({ code: 'BUJ-01', stock: 20 });

    const sinMotivo = await agregar(tokens.admin, orden.id, { partId: pieza.id, quantity: 2 });
    expect(sinMotivo.status).toBe(400);
    expect(sinMotivo.body.error.details.map((d) => d.field)).toContain('reason');
    expect(await stockDe(pieza.id)).toBe(20);

    const conMotivo = await agregar(tokens.admin, orden.id, { partId: pieza.id, quantity: 2, reason: 'Faltó registrar las bujías' });
    expect(conMotivo.status).toBe(201);
    const movimientos = await movimientosDe(pieza.id);
    expect(movimientos[1].reason).toContain('Faltó registrar las bujías');
    expect(movimientos[1].reason).toContain(orden.folio);

    const lineId = conMotivo.body.data.parts[0].id;
    expect((await cambiar(tokens.admin, orden.id, lineId, { quantity: 3 })).status).toBe(400);
    expect((await cambiar(tokens.admin, orden.id, lineId, { quantity: 3, reason: 'Eran tres' })).status).toBe(200);
    expect((await quitar(tokens.admin, orden.id, lineId, {})).status).toBe(400);
    expect((await quitar(tokens.admin, orden.id, lineId, { reason: 'Error de captura' })).status).toBe(200);
    expect(await stockDe(pieza.id)).toBe(20);
  });

  for (const estado of ['ENTREGADO', 'CANCELADA']) {
    test(`en ${estado} nadie puede modificar refacciones (409) y recepción recibe 403`, async () => {
      const { orden, tokens } = await escenarioOrden(estado);
      const pieza = await createPart({ code: 'BUJ-01', stock: 20 });
      for (const rol of ['admin', 'mecanico']) {
        const res = await agregar(tokens[rol], orden.id, { partId: pieza.id, quantity: 1, reason: 'Motivo' });
        expect({ rol, status: res.status }).toEqual({ rol, status: 409 });
      }
      expect((await agregar(tokens.recepcion, orden.id, { partId: pieza.id, quantity: 1 })).status).toBe(403);
      expect(await stockDe(pieza.id)).toBe(20);
    });
  }
});
