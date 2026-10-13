import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioPago } from '../helpers/payments.js';

const lineShape = {
  description: expect.any(String),
  quantity: expect.any(Number),
  unitPrice: expect.any(Number),
  amount: expect.any(Number)
};

const ticketShape = {
  id: expect.any(Number),
  folio: expect.stringMatching(/^TK-\d{4}-\d{4,}$/),
  generatedAt: expect.any(String),
  generatedByName: expect.any(String),
  orderChangedSinceGenerated: false,
  workshop: { name: expect.any(String), address: expect.any(String), phone: expect.any(String) },
  order: { id: expect.any(Number), folio: expect.stringMatching(/^OS-\d{4}-\d{4}$/), status: expect.any(String) },
  client: { name: expect.any(String), phone: expect.any(String) },
  vehicle: { description: expect.any(String), licensePlate: expect.any(String), mileage: expect.any(Number) },
  services: [lineShape],
  labor: [],
  parts: [],
  subtotals: { services: expect.any(Number), labor: expect.any(Number), parts: expect.any(Number) },
  total: expect.any(Number),
  payments: [],
  paymentSummary: {
    total: expect.any(Number),
    collected: expect.any(Number),
    reserved: expect.any(Number),
    balance: expect.any(Number),
    available: expect.any(Number),
    creditBalance: expect.any(Number),
    status: expect.any(String)
  }
};

const generar = (token, orderId) => request(app).post(`/api/orders/${orderId}/ticket`).set(bearer(token));
const consultar = (token, orderId) => request(app).get(`/api/orders/${orderId}/ticket`).set(bearer(token));

describe('contrato de los tickets', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('POST responde 201 la primera vez y 200 después, con la misma forma Ticket', async () => {
    const { orden, tokens } = await escenarioPago();
    const primero = await generar(tokens.recepcion, orden.id);
    expect(primero.status).toBe(201);
    expect(primero.body.data).toEqual(ticketShape);
    const segundo = await generar(tokens.admin, orden.id);
    expect(segundo.status).toBe(200);
    expect(segundo.body.data).toEqual(ticketShape);
  });

  test('GET responde 200 con el ticket existente y 404 TICKET_NOT_FOUND si no existe', async () => {
    const { orden, tokens } = await escenarioPago();
    const antes = await consultar(tokens.recepcion, orden.id);
    expect(antes.status).toBe(404);
    expect(antes.body.error.code).toBe('TICKET_NOT_FOUND');
    await generar(tokens.recepcion, orden.id);
    const despues = await consultar(tokens.recepcion, orden.id);
    expect(despues.status).toBe(200);
    expect(despues.body.data).toEqual(ticketShape);
  });

  test('los errores usan el formato { error: { code, message } }', async () => {
    const abierta = await escenarioPago({ status: 'EN_REPARACION' });
    const casos = [
      [await request(app).post(`/api/orders/${abierta.orden.id}/ticket`), 401, 'UNAUTHENTICATED'],
      [await generar(abierta.tokens.mecanico, abierta.orden.id), 403, 'FORBIDDEN'],
      [await generar(abierta.tokens.admin, 999999), 404, 'NOT_FOUND'],
      [await generar(abierta.tokens.recepcion, abierta.orden.id), 409, 'ORDER_NOT_TICKETABLE'],
      [await request(app).get('/api/orders/abc/ticket').set(bearer(abierta.tokens.admin)), 400, 'VALIDATION_ERROR']
    ];
    for (const [res, status, code] of casos) {
      expect({ code, status: res.status }).toEqual({ code, status });
      expect(res.body.error).toMatchObject({ code, message: expect.any(String) });
    }
  });
});
