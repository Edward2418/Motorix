import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createPart } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

const partShape = {
  id: expect.any(Number),
  code: expect.any(String),
  name: expect.any(String),
  category: expect.any(String),
  brand: expect.any(String),
  stock: expect.any(Number),
  minStock: expect.any(Number),
  stockLevel: expect.stringMatching(/^(NORMAL|BAJO|AGOTADO)$/),
  purchasePrice: expect.any(Number),
  salePrice: expect.any(Number),
  active: expect.any(Boolean),
  createdAt: expect.any(String),
  updatedAt: expect.any(String)
};

const nueva = {
  code: 'BUJ-100',
  name: 'Bujía de iridio',
  category: 'Motor',
  brand: 'NGK',
  initialStock: 12,
  minStock: 4,
  purchasePrice: 85.5,
  salePrice: 129.9
};

describe('contrato de /api/parts', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('POST /parts responde 201 con { data: Part }', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await request(app).post('/api/parts').set(bearer(token)).send(nueva);
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(partShape);
    expect(res.body.data).toMatchObject({ code: 'BUJ-100', stock: 12, stockLevel: 'NORMAL', active: true, salePrice: 129.9 });
  });

  test('POST /parts responde 400 con detalles por campo cuando faltan datos', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await request(app).post('/api/parts').set(bearer(token)).send({ code: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['code', 'name', 'category', 'brand']));
  });

  test('POST /parts responde 409 DUPLICATE_PART_CODE cuando el código ya existe', async () => {
    const { token } = await loginAs('ADMIN');
    await createPart({ code: 'BUJ-100' });
    const res = await request(app).post('/api/parts').set(bearer(token)).send(nueva);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'DUPLICATE_PART_CODE', details: [{ field: 'code' }] });
  });

  test('POST /parts responde 401 sin sesión y 403 para recepción y mecánico', async () => {
    expect((await request(app).post('/api/parts').send(nueva)).status).toBe(401);
    for (const rol of ['RECEPTIONIST', 'MECHANIC']) {
      const { token } = await loginAs(rol, { username: `prueba.${rol.toLowerCase()}` });
      const res = await request(app).post('/api/parts').set(bearer(token)).send(nueva);
      expect({ rol, status: res.status }).toEqual({ rol, status: 403 });
    }
  });

  test('GET /parts devuelve { data: [Part], meta } para el administrador', async () => {
    const { token } = await loginAs('ADMIN');
    await createPart({ code: 'A-1' });
    await createPart({ code: 'A-2', name: 'Filtro', active: false });

    const res = await request(app).get('/api/parts').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 2 });
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toEqual(partShape);
  });

  test('GET /parts para el mecánico no incluye purchasePrice', async () => {
    const { token } = await loginAs('MECHANIC');
    await createPart({ code: 'A-1' });
    const res = await request(app).get('/api/parts').set(bearer(token));
    expect(res.status).toBe(200);
    const { purchasePrice, ...sinCompra } = partShape;
    expect(purchasePrice).toBeDefined();
    expect(res.body.data[0]).toEqual(sinCompra);
    expect(res.body.data[0]).not.toHaveProperty('purchasePrice');
  });

  test('GET /parts responde 403 para recepción y 401 sin sesión', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    expect((await request(app).get('/api/parts').set(bearer(token))).status).toBe(403);
    expect((await request(app).get('/api/parts')).status).toBe(401);
  });

  test('GET /parts/{id} devuelve { data: Part } y 404 si no existe', async () => {
    const { token } = await loginAs('ADMIN');
    const pieza = await createPart({ code: 'A-1' });
    const ok = await request(app).get(`/api/parts/${pieza.id}`).set(bearer(token));
    expect(ok.status).toBe(200);
    expect(ok.body.data).toEqual(partShape);
    expect((await request(app).get('/api/parts/9999').set(bearer(token))).status).toBe(404);
  });

  test('PUT /parts/{id} responde 200 con la refacción actualizada', async () => {
    const { token } = await loginAs('ADMIN');
    const pieza = await createPart({ code: 'A-1', salePrice: 80 });
    const res = await request(app).put(`/api/parts/${pieza.id}`).set(bearer(token)).send({ salePrice: 95.5, minStock: 7 });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(partShape);
    expect(res.body.data).toMatchObject({ salePrice: 95.5, minStock: 7 });
  });

  test('PATCH /parts/{id}/status responde 200 y valida el cuerpo', async () => {
    const { token } = await loginAs('ADMIN');
    const pieza = await createPart({ code: 'A-1' });
    const ok = await request(app).patch(`/api/parts/${pieza.id}/status`).set(bearer(token)).send({ active: false });
    expect(ok.status).toBe(200);
    expect(ok.body.data.active).toBe(false);
    const malo = await request(app).patch(`/api/parts/${pieza.id}/status`).set(bearer(token)).send({});
    expect(malo.status).toBe(400);
  });

  test('GET /parts/categories devuelve { data: [string] } ordenado', async () => {
    const { token } = await loginAs('ADMIN');
    await createPart({ code: 'A-1', category: 'Frenos' });
    await createPart({ code: 'A-2', category: 'Motor' });
    await createPart({ code: 'A-3', category: 'Frenos' });
    const res = await request(app).get('/api/parts/categories').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(['Frenos', 'Motor']);
  });
});
