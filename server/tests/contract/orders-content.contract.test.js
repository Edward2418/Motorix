import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';

const lineaShape = { id: expect.any(Number), description: expect.any(String), amount: expect.any(Number) };

describe('contrato de edición de /api/orders', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('PATCH /orders/{id} devuelve el OrderDetail con los campos actualizados', async () => {
    const { orden, tokens } = await escenarioOrden();
    const res = await request(app)
      .patch(`/api/orders/${orden.id}`)
      .set(bearer(tokens.mecanico))
      .send({ diagnosis: 'Balatas gastadas', notes: 'Se reviso el nivel de liquido', recommendations: 'Cambiar discos' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: orden.id,
      diagnosis: 'Balatas gastadas',
      notes: 'Se reviso el nivel de liquido',
      recommendations: 'Cambiar discos',
      services: [],
      labor: [],
      total: 0,
      history: expect.any(Array),
      allowedTransitions: expect.any(Array)
    });
  });

  test('POST /orders/{id}/services responde 201 con el OrderDetail y el servicio agregado', async () => {
    const { orden, tokens } = await escenarioOrden();
    const res = await request(app)
      .post(`/api/orders/${orden.id}/services`)
      .set(bearer(tokens.mecanico))
      .send({ description: 'Cambio de balatas', amount: 1200.5 });
    expect(res.status).toBe(201);
    expect(res.body.data.services).toEqual([lineaShape]);
    expect(res.body.data.servicesTotal).toBe(1200.5);
    expect(res.body.data.total).toBe(1200.5);
  });

  test('PUT y DELETE /orders/{id}/services/{lineId} devuelven el OrderDetail', async () => {
    const { orden, tokens } = await escenarioOrden();
    const creada = await request(app)
      .post(`/api/orders/${orden.id}/services`)
      .set(bearer(tokens.mecanico))
      .send({ description: 'Alineación', amount: 400 });
    const lineId = creada.body.data.services[0].id;

    const editada = await request(app)
      .put(`/api/orders/${orden.id}/services/${lineId}`)
      .set(bearer(tokens.mecanico))
      .send({ description: 'Alineación y balanceo', amount: 650 });
    expect(editada.status).toBe(200);
    expect(editada.body.data.services[0]).toEqual({ id: lineId, description: 'Alineación y balanceo', amount: 650 });

    const borrada = await request(app)
      .delete(`/api/orders/${orden.id}/services/${lineId}`)
      .set(bearer(tokens.mecanico));
    expect(borrada.status).toBe(200);
    expect(borrada.body.data.services).toEqual([]);
    expect(borrada.body.data.total).toBe(0);
  });

  test('POST, PUT y DELETE de /orders/{id}/labor devuelven el OrderDetail', async () => {
    const { orden, tokens } = await escenarioOrden();
    const creada = await request(app)
      .post(`/api/orders/${orden.id}/labor`)
      .set(bearer(tokens.mecanico))
      .send({ description: 'Mano de obra frenos', amount: 350 });
    expect(creada.status).toBe(201);
    expect(creada.body.data.labor).toEqual([lineaShape]);
    expect(creada.body.data.laborTotal).toBe(350);

    const lineId = creada.body.data.labor[0].id;
    const editada = await request(app)
      .put(`/api/orders/${orden.id}/labor/${lineId}`)
      .set(bearer(tokens.mecanico))
      .send({ description: 'Mano de obra frenos', amount: 400 });
    expect(editada.body.data.labor[0].amount).toBe(400);

    const borrada = await request(app).delete(`/api/orders/${orden.id}/labor/${lineId}`).set(bearer(tokens.mecanico));
    expect(borrada.body.data.labor).toEqual([]);
  });

  test('los errores de validación usan { error: { code, message, details } }', async () => {
    const { orden, tokens } = await escenarioOrden();
    const res = await request(app)
      .post(`/api/orders/${orden.id}/services`)
      .set(bearer(tokens.mecanico))
      .send({ description: '', amount: -5 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field).sort()).toEqual(['amount', 'description']);
  });
});
