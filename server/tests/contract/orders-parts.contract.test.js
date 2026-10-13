import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createPart, addServiceLine } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';

afterAll(closePool);

const lineaShape = {
  id: expect.any(Number),
  partId: expect.any(Number),
  code: 'BUJ-01',
  name: 'Bujía de iridio',
  quantity: 2,
  unitPrice: 100,
  subtotal: 200
};

const agregar = (token, orderId, body) => request(app).post(`/api/orders/${orderId}/parts`).set(bearer(token)).send(body);

describe('contrato de /api/orders/{id}/parts', () => {
  beforeEach(resetTables);

  test('POST responde 201 con OrderDetail: parts, partsTotal y un total que incluye las refacciones', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    await addServiceLine(orden.id, 'Afinación', 500);
    const pieza = await createPart({ code: 'BUJ-01', name: 'Bujía de iridio', stock: 10, salePrice: 100 });

    const res = await agregar(tokens.mecanico, orden.id, { partId: pieza.id, quantity: 2 });
    expect(res.status).toBe(201);
    expect(res.body.data.parts).toEqual([lineaShape]);
    expect(res.body.data).toMatchObject({ servicesTotal: 500, laborTotal: 0, partsTotal: 200, total: 700, id: orden.id });
    expect(res.body.data.allowedTransitions).toEqual(expect.any(Array));
  });

  test('PUT responde 200 con OrderDetail y la cantidad nueva', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const pieza = await createPart({ code: 'BUJ-01', name: 'Bujía de iridio', stock: 10, salePrice: 100 });
    const alta = await agregar(tokens.mecanico, orden.id, { partId: pieza.id, quantity: 2 });
    const lineId = alta.body.data.parts[0].id;

    const res = await request(app).put(`/api/orders/${orden.id}/parts/${lineId}`).set(bearer(tokens.mecanico)).send({ quantity: 3 });
    expect(res.status).toBe(200);
    expect(res.body.data.parts).toEqual([{ ...lineaShape, quantity: 3, subtotal: 300 }]);
    expect(res.body.data.partsTotal).toBe(300);
  });

  test('DELETE responde 200 con OrderDetail sin la línea', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const pieza = await createPart({ code: 'BUJ-01', stock: 10 });
    const alta = await agregar(tokens.mecanico, orden.id, { partId: pieza.id, quantity: 2 });
    const lineId = alta.body.data.parts[0].id;

    const res = await request(app).delete(`/api/orders/${orden.id}/parts/${lineId}`).set(bearer(tokens.mecanico));
    expect(res.status).toBe(200);
    expect(res.body.data.parts).toEqual([]);
    expect(res.body.data.partsTotal).toBe(0);
  });

  test('400 VALIDATION_ERROR con detalles por campo', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const res = await agregar(tokens.mecanico, orden.id, { partId: 'x', quantity: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['partId', 'quantity']));
  });

  test('401 sin sesión, 403 sin permiso y 404 si la orden o la refacción no existen', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const pieza = await createPart({ code: 'BUJ-01', stock: 10 });
    expect((await request(app).post(`/api/orders/${orden.id}/parts`).send({ partId: pieza.id, quantity: 1 })).status).toBe(401);
    expect((await agregar(tokens.recepcion, orden.id, { partId: pieza.id, quantity: 1 })).status).toBe(403);
    expect((await agregar(tokens.mecanico, 99999, { partId: pieza.id, quantity: 1 })).status).toBe(404);
    expect((await agregar(tokens.mecanico, orden.id, { partId: 99999, quantity: 1 })).status).toBe(404);
    expect((await request(app).put(`/api/orders/${orden.id}/parts/99999`).set(bearer(tokens.mecanico)).send({ quantity: 1 })).status).toBe(404);
    expect((await request(app).delete(`/api/orders/${orden.id}/parts/99999`).set(bearer(tokens.mecanico))).status).toBe(404);
  });

  test('409 con los códigos INSUFFICIENT_STOCK, PART_ALREADY_IN_ORDER y PART_INACTIVE', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const pocas = await createPart({ code: 'POC-01', stock: 1 });
    const inactiva = await createPart({ code: 'INA-01', stock: 5, active: false });

    const sinStock = await agregar(tokens.mecanico, orden.id, { partId: pocas.id, quantity: 2 });
    expect(sinStock.status).toBe(409);
    expect(sinStock.body.error).toMatchObject({ code: 'INSUFFICIENT_STOCK', message: expect.stringContaining('disponible 1 unidad') });

    await agregar(tokens.mecanico, orden.id, { partId: pocas.id, quantity: 1 });
    const repetida = await agregar(tokens.mecanico, orden.id, { partId: pocas.id, quantity: 1 });
    expect(repetida.body.error.code).toBe('PART_ALREADY_IN_ORDER');

    const desactivada = await agregar(tokens.mecanico, orden.id, { partId: inactiva.id, quantity: 1 });
    expect(desactivada.status).toBe(409);
    expect(desactivada.body.error.code).toBe('PART_INACTIVE');
  });
});
