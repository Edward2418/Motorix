import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createPart } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

const movimientoShape = {
  id: expect.any(Number),
  partId: expect.any(Number),
  type: expect.stringMatching(/^(ENTRADA|SALIDA|AJUSTE)$/),
  quantity: expect.any(Number),
  stockAfter: expect.any(Number),
  reason: expect.any(String),
  orderId: null,
  orderFolio: null,
  createdByName: expect.any(String),
  createdAt: expect.any(String)
};

describe('contrato de /api/parts/{id}/movements', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('POST registra una ENTRADA y responde 201 con { data: InventoryMovement }', async () => {
    const { token } = await loginAs('ADMIN');
    const pieza = await createPart({ stock: 10 });
    const res = await request(app)
      .post(`/api/parts/${pieza.id}/movements`)
      .set(bearer(token))
      .send({ type: 'ENTRADA', quantity: 5, reason: 'Compra al proveedor' });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(movimientoShape);
    expect(res.body.data).toMatchObject({ type: 'ENTRADA', quantity: 5, stockAfter: 15, reason: 'Compra al proveedor' });
  });

  test('POST registra un AJUSTE por conteo y devuelve la diferencia con signo', async () => {
    const { token } = await loginAs('ADMIN');
    const pieza = await createPart({ stock: 10 });
    const res = await request(app)
      .post(`/api/parts/${pieza.id}/movements`)
      .set(bearer(token))
      .send({ type: 'AJUSTE', countedStock: 7, reason: 'Conteo físico' });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(movimientoShape);
    expect(res.body.data).toMatchObject({ type: 'AJUSTE', quantity: -3, stockAfter: 7 });
  });

  test('POST responde 400 con detalles por campo para datos inválidos y para una SALIDA manual', async () => {
    const { token } = await loginAs('ADMIN');
    const pieza = await createPart();
    const sinMotivo = await request(app).post(`/api/parts/${pieza.id}/movements`).set(bearer(token)).send({ type: 'ENTRADA', quantity: 5 });
    expect(sinMotivo.status).toBe(400);
    expect(sinMotivo.body.error.details.map((d) => d.field)).toContain('reason');
    const salida = await request(app)
      .post(`/api/parts/${pieza.id}/movements`)
      .set(bearer(token))
      .send({ type: 'SALIDA', quantity: 1, reason: 'x' });
    expect(salida.status).toBe(400);
    expect(salida.body.error.details.map((d) => d.field)).toContain('type');
  });

  test('POST responde 409 NO_ADJUSTMENT_NEEDED cuando el conteo coincide con el stock', async () => {
    const { token } = await loginAs('ADMIN');
    const pieza = await createPart({ stock: 10 });
    const res = await request(app)
      .post(`/api/parts/${pieza.id}/movements`)
      .set(bearer(token))
      .send({ type: 'AJUSTE', countedStock: 10, reason: 'Conteo físico' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_ADJUSTMENT_NEEDED');
  });

  test('POST y GET responden 401 sin sesión, 403 para recepción y mecánico y 404 si la refacción no existe', async () => {
    const pieza = await createPart();
    const ruta = `/api/parts/${pieza.id}/movements`;
    expect((await request(app).get(ruta)).status).toBe(401);
    expect((await request(app).post(ruta).send({})).status).toBe(401);
    for (const rol of ['RECEPTIONIST', 'MECHANIC']) {
      const { token } = await loginAs(rol, { username: `prueba.${rol.toLowerCase()}` });
      expect({ rol, status: (await request(app).get(ruta).set(bearer(token))).status }).toEqual({ rol, status: 403 });
      const res = await request(app).post(ruta).set(bearer(token)).send({ type: 'ENTRADA', quantity: 1, reason: 'x' });
      expect({ rol, status: res.status }).toEqual({ rol, status: 403 });
    }
    const admin = await loginAs('ADMIN');
    expect((await request(app).get('/api/parts/9999/movements').set(bearer(admin.token))).status).toBe(404);
    const noExiste = await request(app).post('/api/parts/9999/movements').set(bearer(admin.token)).send({ type: 'ENTRADA', quantity: 1, reason: 'x' });
    expect(noExiste.status).toBe(404);
  });

  test('GET devuelve { data: [InventoryMovement], meta } con el más reciente primero', async () => {
    const { token } = await loginAs('ADMIN');
    const pieza = await createPart({ stock: 10 });
    await request(app).post(`/api/parts/${pieza.id}/movements`).set(bearer(token)).send({ type: 'ENTRADA', quantity: 5, reason: 'Compra' });

    const res = await request(app).get(`/api/parts/${pieza.id}/movements`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 2 });
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toEqual(movimientoShape);
    expect(res.body.data.map((m) => m.reason)).toEqual(['Compra', 'Stock inicial']);
  });
});
