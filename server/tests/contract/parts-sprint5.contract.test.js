import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createPart } from '../helpers/db.js';
import { bearer, loginAs } from '../helpers/auth.js';

afterAll(closePool);

const cuerpo = {
  code: 'BUJ-100',
  name: 'Bujía de iridio',
  category: 'Motor',
  brand: 'NGK',
  initialStock: 5,
  minStock: 2,
  purchasePrice: 100,
  salePrice: 80
};

const errorBajoElCosto = {
  error: {
    code: 'PRICE_BELOW_COST',
    message: expect.stringContaining('menor al de compra'),
    details: [{ field: 'salePrice', message: expect.stringContaining('menor al de compra') }]
  }
};

describe('contrato de /api/parts con confirmBelowCost (Sprint 5)', () => {
  beforeEach(resetTables);

  test('POST responde 422 con el formato { error: { code, message, details } } si el precio de venta es menor al de compra', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await request(app).post('/api/parts').set(bearer(token)).send(cuerpo);
    expect(res.status).toBe(422);
    expect(res.body).toEqual(errorBajoElCosto);
  });

  test('PUT responde 422 con el mismo formato', async () => {
    const { token } = await loginAs('ADMIN');
    const pieza = await createPart({ code: 'EXI-01', purchasePrice: 50, salePrice: 80 });
    const res = await request(app).put(`/api/parts/${pieza.id}`).set(bearer(token)).send({ salePrice: 10 });
    expect(res.status).toBe(422);
    expect(res.body).toEqual(errorBajoElCosto);
  });

  test('con confirmBelowCost POST responde 201 con la refacción y sin exponer el campo de confirmación', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await request(app).post('/api/parts').set(bearer(token)).send({ ...cuerpo, confirmBelowCost: true });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      id: expect.any(Number),
      code: 'BUJ-100',
      purchasePrice: 100,
      salePrice: 80,
      stock: 5
    });
    expect(res.body.data).not.toHaveProperty('confirmBelowCost');
  });

  test('un valor de confirmBelowCost que no es booleano responde 400 con detalle en ese campo', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await request(app).post('/api/parts').set(bearer(token)).send({ ...cuerpo, confirmBelowCost: 'si' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toContain('confirmBelowCost');
  });
});
