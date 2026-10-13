import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createClient, createVehicle, createMechanic, createOrder, createPart, createOrderPart } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

afterAll(closePool);

const movimiento = (token, partId, body) => request(app).post(`/api/parts/${partId}/movements`).set(bearer(token)).send(body);
const entrada = (token, partId, quantity, reason = 'Compra') => movimiento(token, partId, { type: 'ENTRADA', quantity, reason });
const ajuste = (token, partId, countedStock, reason = 'Conteo físico') => movimiento(token, partId, { type: 'AJUSTE', countedStock, reason });

const stockDe = async (partId) => (await pool.query('SELECT stock FROM parts WHERE id = ?', [partId]))[0][0].stock;
const sumaDe = async (partId) =>
  Number((await pool.query('SELECT COALESCE(SUM(quantity), 0) AS total FROM inventory_movements WHERE part_id = ?', [partId]))[0][0].total);

describe('movimientos de inventario', () => {
  beforeEach(resetTables);

  test('una ENTRADA suma al stock y guarda tipo, cantidad con signo, motivo, usuario y stock resultante', async () => {
    const admin = await loginAs('ADMIN', { name: 'Ana Administradora' });
    const pieza = await createPart({ stock: 10 });

    const res = await entrada(admin.token, pieza.id, 5, 'Compra al proveedor');
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      partId: pieza.id,
      type: 'ENTRADA',
      quantity: 5,
      stockAfter: 15,
      reason: 'Compra al proveedor',
      createdByName: 'Ana Administradora',
      orderId: null
    });
    expect(await stockDe(pieza.id)).toBe(15);
  });

  test('un AJUSTE fija el stock al valor contado y guarda la diferencia con signo, hacia arriba o hacia abajo', async () => {
    const { token } = await loginAs('ADMIN');
    const pieza = await createPart({ stock: 10 });

    const sube = await ajuste(token, pieza.id, 14);
    expect(sube.body.data).toMatchObject({ type: 'AJUSTE', quantity: 4, stockAfter: 14 });
    const baja = await ajuste(token, pieza.id, 6);
    expect(baja.body.data).toMatchObject({ type: 'AJUSTE', quantity: -8, stockAfter: 6 });
    expect(await stockDe(pieza.id)).toBe(6);
  });

  test('un ajuste a cero es válido y deja la refacción agotada', async () => {
    const { token } = await loginAs('ADMIN');
    const pieza = await createPart({ stock: 4 });
    const res = await ajuste(token, pieza.id, 0);
    expect(res.status).toBe(201);
    expect(await stockDe(pieza.id)).toBe(0);
    const detalle = await request(app).get(`/api/parts/${pieza.id}`).set(bearer(token));
    expect(detalle.body.data.stockLevel).toBe('AGOTADO');
  });

  test('un ajuste sin diferencia responde 409 y no crea ningún movimiento', async () => {
    const { token } = await loginAs('ADMIN');
    const pieza = await createPart({ stock: 10 });
    const res = await ajuste(token, pieza.id, 10);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_ADJUSTMENT_NEEDED');
    expect(await sumaDe(pieza.id)).toBe(10);
    expect((await pool.query('SELECT COUNT(*) AS total FROM inventory_movements WHERE part_id = ?', [pieza.id]))[0][0].total).toBe(1);
  });

  test('el stock nunca queda negativo ni supera el máximo', async () => {
    const { token } = await loginAs('ADMIN');
    const pieza = await createPart({ stock: 10 });

    expect((await ajuste(token, pieza.id, -1)).status).toBe(400);
    expect((await ajuste(token, pieza.id, 100000000)).status).toBe(400);
    expect((await entrada(token, pieza.id, 0)).status).toBe(400);
    expect((await entrada(token, pieza.id, -5)).status).toBe(400);
    expect(await stockDe(pieza.id)).toBe(10);

    await pool.query('UPDATE parts SET stock = 99999990 WHERE id = ?', [pieza.id]);
    await pool.query("INSERT INTO inventory_movements (part_id, type, quantity, stock_after, reason, created_by) VALUES (?, 'AJUSTE', 99999980, 99999990, 'Preparación', (SELECT id FROM users LIMIT 1))", [pieza.id]);
    const excede = await entrada(token, pieza.id, 20);
    expect(excede.status).toBe(400);
    expect(await stockDe(pieza.id)).toBe(99999990);
  });

  test('el historial se lista del más reciente al más antiguo, paginado, con la orden relacionada', async () => {
    const admin = await loginAs('ADMIN');
    const mecanico = await createMechanic();
    const cliente = await createClient();
    const vehiculo = await createVehicle({ clientId: cliente.id });
    const orden = await createOrder({ clientId: cliente.id, vehicleId: vehiculo.id, mechanicId: mecanico.id, status: 'EN_REPARACION' });
    const pieza = await createPart({ stock: 10 });
    await createOrderPart({ orderId: orden.id, partId: pieza.id, quantity: 3 });
    await entrada(admin.token, pieza.id, 5, 'Reabastecimiento');

    const pagina1 = await request(app).get(`/api/parts/${pieza.id}/movements?pageSize=2&page=1`).set(bearer(admin.token));
    const pagina2 = await request(app).get(`/api/parts/${pieza.id}/movements?pageSize=2&page=2`).set(bearer(admin.token));
    expect(pagina1.body.meta).toEqual({ page: 1, pageSize: 2, total: 3 });
    expect(pagina1.body.data.map((m) => m.type)).toEqual(['ENTRADA', 'SALIDA']);
    expect(pagina1.body.data[1]).toMatchObject({ quantity: -3, orderId: orden.id, orderFolio: orden.folio });
    expect(pagina2.body.data.map((m) => m.reason)).toEqual(['Stock inicial']);
  });

  test('el stock actual coincide siempre con la suma de los movimientos', async () => {
    const { token } = await loginAs('ADMIN');
    const pieza = await createPart({ stock: 10 });
    for (const paso of [
      () => entrada(token, pieza.id, 7),
      () => ajuste(token, pieza.id, 3),
      () => entrada(token, pieza.id, 25),
      () => ajuste(token, pieza.id, 0),
      () => entrada(token, pieza.id, 1)
    ]) {
      await paso();
      expect(await stockDe(pieza.id)).toBe(await sumaDe(pieza.id));
    }
    expect(await stockDe(pieza.id)).toBe(1);
  });

  test('los movimientos no se modifican ni se eliminan: no existen esas rutas', async () => {
    const { token } = await loginAs('ADMIN');
    const pieza = await createPart();
    const lista = await request(app).get(`/api/parts/${pieza.id}/movements`).set(bearer(token));
    const id = lista.body.data[0].id;
    for (const metodo of ['put', 'patch', 'delete']) {
      const res = await request(app)[metodo](`/api/parts/${pieza.id}/movements/${id}`).set(bearer(token)).send({ reason: 'cambio' });
      expect({ metodo, status: res.status }).toEqual({ metodo, status: 404 });
    }
    expect((await request(app).delete(`/api/parts/${pieza.id}/movements`).set(bearer(token))).status).toBe(404);
  });

  test('solo el administrador consulta y registra movimientos', async () => {
    const pieza = await createPart();
    for (const rol of ['RECEPTIONIST', 'MECHANIC']) {
      const { token } = await loginAs(rol, { username: `prueba.${rol.toLowerCase()}` });
      expect((await request(app).get(`/api/parts/${pieza.id}/movements`).set(bearer(token))).status).toBe(403);
      expect((await entrada(token, pieza.id, 1)).status).toBe(403);
    }
  });

  test('una refacción inexistente responde 404', async () => {
    const { token } = await loginAs('ADMIN');
    expect((await entrada(token, 9999, 1)).status).toBe(404);
    expect((await request(app).get('/api/parts/9999/movements').set(bearer(token))).status).toBe(404);
  });

  test('también se registran movimientos en una refacción desactivada', async () => {
    const { token } = await loginAs('ADMIN');
    const pieza = await createPart({ stock: 2, active: false });
    expect((await entrada(token, pieza.id, 3)).status).toBe(201);
    expect(await stockDe(pieza.id)).toBe(5);
  });

  test('dos ajustes simultáneos sobre la misma refacción terminan en un stock coherente con sus movimientos', async () => {
    const { token } = await loginAs('ADMIN');
    const pieza = await createPart({ stock: 10 });

    const [a, b] = await Promise.all([ajuste(token, pieza.id, 4), ajuste(token, pieza.id, 15)]);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(await stockDe(pieza.id)).toBe(await sumaDe(pieza.id));
    const ultimo = (await pool.query('SELECT stock_after FROM inventory_movements WHERE part_id = ? ORDER BY id DESC LIMIT 1', [pieza.id]))[0][0];
    expect(await stockDe(pieza.id)).toBe(ultimo.stock_after);
  });
});

describe('restricciones de la base de datos sobre el inventario', () => {
  beforeEach(resetTables);

  test('la base rechaza un stock negativo aunque falle el código', async () => {
    const pieza = await createPart({ stock: 10 });
    await expect(pool.query('UPDATE parts SET stock = stock - 11 WHERE id = ?', [pieza.id])).rejects.toBeDefined();
    await expect(pool.query('UPDATE parts SET stock = -1 WHERE id = ?', [pieza.id])).rejects.toBeDefined();
    expect(await stockDe(pieza.id)).toBe(10);
  });

  test('la base rechaza un movimiento cuyo signo no corresponde a su tipo', async () => {
    const pieza = await createPart({ stock: 10 });
    const [[usuario]] = await pool.query('SELECT id FROM users LIMIT 1');
    const insertar = (type, quantity, orderId = null) =>
      pool.query('INSERT INTO inventory_movements (part_id, type, quantity, stock_after, reason, order_id, created_by) VALUES (?, ?, ?, 5, ?, ?, ?)', [
        pieza.id,
        type,
        quantity,
        'Prueba',
        orderId,
        usuario.id
      ]);
    await expect(insertar('ENTRADA', -1)).rejects.toBeDefined();
    await expect(insertar('SALIDA', 1)).rejects.toBeDefined();
    await expect(insertar('AJUSTE', 0)).rejects.toBeDefined();
  });

  test('la base rechaza una SALIDA que no pertenece a ninguna orden', async () => {
    const pieza = await createPart({ stock: 10 });
    const [[usuario]] = await pool.query('SELECT id FROM users LIMIT 1');
    await expect(
      pool.query("INSERT INTO inventory_movements (part_id, type, quantity, stock_after, reason, created_by) VALUES (?, 'SALIDA', -1, 9, 'Sin orden', ?)", [pieza.id, usuario.id])
    ).rejects.toBeDefined();
  });
});
