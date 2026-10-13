import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createPart } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

afterAll(closePool);

const alta = (token, extra = {}) =>
  request(app)
    .post('/api/parts')
    .set(bearer(token))
    .send({
      code: 'BUJ-100',
      name: 'Bujía de iridio',
      category: 'Motor',
      brand: 'NGK',
      initialStock: 12,
      minStock: 4,
      purchasePrice: 85.5,
      salePrice: 129.9,
      ...extra
    });

const movimientosDe = async (partId) =>
  (await pool.query('SELECT type, quantity, stock_after, reason, order_id FROM inventory_movements WHERE part_id = ? ORDER BY id', [partId]))[0];

describe('catálogo de refacciones', () => {
  beforeEach(resetTables);

  test('el alta con stock inicial crea la refacción activa y su movimiento «Stock inicial»', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await alta(token);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ code: 'BUJ-100', stock: 12, minStock: 4, active: true, stockLevel: 'NORMAL' });

    const movimientos = await movimientosDe(res.body.data.id);
    expect(movimientos).toEqual([{ type: 'ENTRADA', quantity: 12, stock_after: 12, reason: 'Stock inicial', order_id: null }]);
  });

  test('el alta sin stock inicial no genera movimientos y queda agotada', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await alta(token, { initialStock: 0 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ stock: 0, stockLevel: 'AGOTADO' });
    expect(await movimientosDe(res.body.data.id)).toEqual([]);
  });

  test('recorta los espacios del código y del nombre', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await alta(token, { code: '  BUJ-100  ', name: '  Bujía  ' });
    expect(res.body.data).toMatchObject({ code: 'BUJ-100', name: 'Bujía' });
  });

  test('un código duplicado se rechaza sin distinguir mayúsculas ni espacios laterales', async () => {
    const { token } = await loginAs('ADMIN');
    await alta(token);
    for (const code of ['BUJ-100', 'buj-100', '  Buj-100 ']) {
      const res = await alta(token, { code });
      expect({ code, status: res.status, error: res.body.error?.code }).toEqual({
        code,
        status: 409,
        error: 'DUPLICATE_PART_CODE'
      });
    }
    expect((await pool.query('SELECT COUNT(*) AS total FROM parts'))[0][0].total).toBe(1);
  });

  test('editar cambia datos, precios y mínimo sin tocar el stock ni los movimientos', async () => {
    const { token } = await loginAs('ADMIN');
    const creada = (await alta(token)).body.data;

    const res = await request(app)
      .put(`/api/parts/${creada.id}`)
      .set(bearer(token))
      .send({ name: 'Bujía de platino', brand: 'Bosch', salePrice: 150, purchasePrice: 99.99, minStock: 6 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'Bujía de platino', brand: 'Bosch', salePrice: 150, purchasePrice: 99.99, minStock: 6, stock: 12 });
    expect(await movimientosDe(creada.id)).toHaveLength(1);
  });

  test('un PUT que intenta fijar el stock se rechaza y no lo cambia', async () => {
    const { token } = await loginAs('ADMIN');
    const creada = (await alta(token)).body.data;
    const res = await request(app).put(`/api/parts/${creada.id}`).set(bearer(token)).send({ stock: 500 });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain('stock');
    expect((await pool.query('SELECT stock FROM parts WHERE id = ?', [creada.id]))[0][0].stock).toBe(12);
  });

  test('editar el código a uno que ya existe responde 409; conservar el propio no es duplicado', async () => {
    const { token } = await loginAs('ADMIN');
    const primera = (await alta(token)).body.data;
    await alta(token, { code: 'FIL-200', name: 'Filtro' });

    const duplicado = await request(app).put(`/api/parts/${primera.id}`).set(bearer(token)).send({ code: 'fil-200' });
    expect(duplicado.status).toBe(409);
    expect(duplicado.body.error.code).toBe('DUPLICATE_PART_CODE');

    const propio = await request(app).put(`/api/parts/${primera.id}`).set(bearer(token)).send({ code: 'buj-100', name: 'Bujía 2' });
    expect(propio.status).toBe(200);
    expect(propio.body.data.name).toBe('Bujía 2');
  });

  test('desactivar y reactivar conserva los movimientos y nada se elimina', async () => {
    const { token } = await loginAs('ADMIN');
    const creada = (await alta(token)).body.data;

    const baja = await request(app).patch(`/api/parts/${creada.id}/status`).set(bearer(token)).send({ active: false });
    expect(baja.body.data.active).toBe(false);
    const alta2 = await request(app).patch(`/api/parts/${creada.id}/status`).set(bearer(token)).send({ active: true });
    expect(alta2.body.data.active).toBe(true);
    expect(await movimientosDe(creada.id)).toHaveLength(1);

    expect((await request(app).delete(`/api/parts/${creada.id}`).set(bearer(token))).status).toBe(404);
  });

  test('busca por código, nombre y marca', async () => {
    const { token } = await loginAs('ADMIN');
    await createPart({ code: 'BUJ-100', name: 'Bujía de iridio', brand: 'NGK' });
    await createPart({ code: 'FIL-200', name: 'Filtro de aceite', brand: 'Mann' });
    await createPart({ code: 'BAL-300', name: 'Balatas', brand: 'Brembo' });

    const buscar = async (q) => (await request(app).get(`/api/parts?q=${encodeURIComponent(q)}`).set(bearer(token))).body.data.map((p) => p.code);
    expect(await buscar('buj')).toEqual(['BUJ-100']);
    expect(await buscar('aceite')).toEqual(['FIL-200']);
    expect(await buscar('brembo')).toEqual(['BAL-300']);
    expect(await buscar('xyz')).toEqual([]);
  });

  test('filtra por categoría, estado activo y nivel de stock', async () => {
    const { token } = await loginAs('ADMIN');
    await createPart({ code: 'A-1', category: 'Motor', stock: 20, minStock: 5 });
    await createPart({ code: 'A-2', category: 'Frenos', stock: 3, minStock: 5 });
    await createPart({ code: 'A-3', category: 'Frenos', stock: 0, minStock: 5 });
    await createPart({ code: 'A-4', category: 'Motor', stock: 20, minStock: 5, active: false });

    const codigos = async (query) => (await request(app).get(`/api/parts?${query}`).set(bearer(token))).body.data.map((p) => p.code).sort();
    expect(await codigos('category=Frenos')).toEqual(['A-2', 'A-3']);
    expect(await codigos('active=false')).toEqual(['A-4']);
    expect(await codigos('active=true')).toEqual(['A-1', 'A-2', 'A-3']);
    expect(await codigos('stockLevel=BAJO')).toEqual(['A-2']);
    expect(await codigos('stockLevel=AGOTADO')).toEqual(['A-3']);
    expect(await codigos('stockLevel=NORMAL')).toEqual(['A-1', 'A-4']);
  });

  test('pagina el listado', async () => {
    const { token } = await loginAs('ADMIN');
    for (let i = 1; i <= 5; i += 1) {
      await createPart({ code: `P-${i}`, name: `Pieza ${i}`, stock: 0 });
    }
    const pagina2 = await request(app).get('/api/parts?pageSize=2&page=2').set(bearer(token));
    expect(pagina2.body.data.map((p) => p.code)).toEqual(['P-3', 'P-4']);
    expect(pagina2.body.meta).toEqual({ page: 2, pageSize: 2, total: 5 });
  });

  test('solo el administrador crea, edita y cambia el estado; recepción no accede a nada', async () => {
    const admin = await loginAs('ADMIN');
    const pieza = (await alta(admin.token)).body.data;
    const recepcion = await loginAs('RECEPTIONIST');
    const mecanico = await loginAs('MECHANIC');

    for (const token of [recepcion.token, mecanico.token]) {
      expect((await alta(token, { code: 'OTRA-1' })).status).toBe(403);
      expect((await request(app).put(`/api/parts/${pieza.id}`).set(bearer(token)).send({ name: 'X' })).status).toBe(403);
      expect((await request(app).patch(`/api/parts/${pieza.id}/status`).set(bearer(token)).send({ active: false })).status).toBe(403);
    }
    for (const ruta of ['/api/parts', `/api/parts/${pieza.id}`, '/api/parts/categories']) {
      expect({ ruta, status: (await request(app).get(ruta).set(bearer(recepcion.token))).status }).toEqual({ ruta, status: 403 });
    }
  });

  test('el mecánico solo ve refacciones activas y sin precio de compra', async () => {
    const mecanico = await loginAs('MECHANIC');
    const activa = await createPart({ code: 'A-1' });
    const inactiva = await createPart({ code: 'A-2', active: false });

    const lista = await request(app).get('/api/parts').set(bearer(mecanico.token));
    expect(lista.body.data.map((p) => p.code)).toEqual(['A-1']);
    expect(lista.body.data[0]).not.toHaveProperty('purchasePrice');

    const detalle = await request(app).get(`/api/parts/${activa.id}`).set(bearer(mecanico.token));
    expect(detalle.status).toBe(200);
    expect(detalle.body.data).not.toHaveProperty('purchasePrice');
    expect((await request(app).get(`/api/parts/${inactiva.id}`).set(bearer(mecanico.token))).status).toBe(404);
  });

  test('un mecánico que envía active=false o lowStock=true sigue viendo solo refacciones activas', async () => {
    const mecanico = await loginAs('MECHANIC');
    await createPart({ code: 'A-1', stock: 20, minStock: 5 });
    await createPart({ code: 'A-2', stock: 1, minStock: 5 });
    await createPart({ code: 'A-3', active: false });

    const inactivas = await request(app).get('/api/parts?active=false').set(bearer(mecanico.token));
    expect(inactivas.body.data.map((p) => p.code).sort()).toEqual(['A-1', 'A-2']);
    const bajas = await request(app).get('/api/parts?lowStock=true').set(bearer(mecanico.token));
    expect(bajas.body.data.map((p) => p.code).sort()).toEqual(['A-1', 'A-2']);
  });

  test('las categorías son únicas y están ordenadas; el mecánico solo ve las de refacciones activas', async () => {
    const admin = await loginAs('ADMIN');
    const mecanico = await loginAs('MECHANIC');
    await createPart({ code: 'A-1', category: 'Motor' });
    await createPart({ code: 'A-2', category: 'Eléctrico', active: false });
    await createPart({ code: 'A-3', category: 'Frenos' });

    const comoAdmin = await request(app).get('/api/parts/categories').set(bearer(admin.token));
    expect(comoAdmin.body.data).toEqual(['Eléctrico', 'Frenos', 'Motor']);
    const comoMecanico = await request(app).get('/api/parts/categories').set(bearer(mecanico.token));
    expect(comoMecanico.body.data).toEqual(['Frenos', 'Motor']);
  });
});
