import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { createFakeGateway, installFakeGateway, uninstallFakeGateway } from '../helpers/fakeGateway.js';
import { escenarioPago, registrarPago, listarPagos } from '../helpers/payments.js';

const resumenShape = {
  total: expect.any(Number),
  collected: expect.any(Number),
  reserved: expect.any(Number),
  balance: expect.any(Number),
  available: expect.any(Number),
  creditBalance: expect.any(Number),
  status: expect.stringMatching(/^(SIN_PAGO|PARCIAL|PAGADA)$/),
  hasOutdatedPending: expect.any(Boolean)
};

describe('contrato de los campos nuevos de pagos (Sprint 5)', () => {
  beforeEach(async () => {
    await resetTables();
    await installFakeGateway(createFakeGateway({ enabled: true }));
  });
  afterAll(async () => {
    await uninstallFakeGateway();
    await closePool();
  });

  test('cada pago trae totalAtCreation (número) y outdated (booleano), y el resumen trae hasOutdatedPending', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'TERMINADO', total: 1000 });
    const creado = await registrarPago(tokens.recepcion, orden.id, { amount: 400, method: 'MERCADO_PAGO' });
    expect(creado.status).toBe(201);
    expect(creado.body.data.payment).toMatchObject({ totalAtCreation: 1000, outdated: false });
    expect(creado.body.data.summary).toEqual(resumenShape);

    const lista = await listarPagos(tokens.admin, orden.id);
    expect(lista.status).toBe(200);
    expect(lista.body.data.payments[0]).toMatchObject({ totalAtCreation: expect.any(Number), outdated: expect.any(Boolean) });
    expect(lista.body.data.summary).toEqual(resumenShape);
  });

  test('el detalle de la orden trae hasOutdatedPending dentro de payment para administración y recepción', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'TERMINADO', total: 1000 });
    for (const token of [tokens.admin, tokens.recepcion]) {
      const res = await request(app).get(`/api/orders/${orden.id}`).set(bearer(token));
      expect(res.status).toBe(200);
      expect(res.body.data.payment).toEqual(resumenShape);
    }
  });

  test('el mecánico no recibe ninguno de los campos nuevos', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'TERMINADO', total: 1000 });
    const res = await request(app).get(`/api/orders/${orden.id}`).set(bearer(tokens.mecanico));
    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('payment');
    expect(JSON.stringify(res.body)).not.toMatch(/hasOutdatedPending|totalAtCreation|outdated/);
  });
});
