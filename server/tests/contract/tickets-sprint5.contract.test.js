import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createTicket } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioPago } from '../helpers/payments.js';

afterAll(closePool);

// La forma de la respuesta del ticket no cambia en el Sprint 5: solo cambia de dónde salen los datos.
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
  orderChangedSinceGenerated: expect.any(Boolean),
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

describe('contrato del ticket con contenido guardado', () => {
  beforeEach(resetTables);

  test('el ticket nuevo (con contenido guardado) tiene la misma forma que el del Sprint 4, al emitirlo y al consultarlo', async () => {
    const { orden, tokens } = await escenarioPago();
    const emitido = await generar(tokens.recepcion, orden.id);
    expect(emitido.status).toBe(201);
    expect(emitido.body.data).toEqual(ticketShape);
    const consulta = await consultar(tokens.recepcion, orden.id);
    expect(consulta.status).toBe(200);
    expect(consulta.body.data).toEqual(ticketShape);
  });

  test('el ticket anterior (sin contenido guardado) conserva exactamente la misma forma', async () => {
    const { orden, tokens } = await escenarioPago();
    await createTicket({ orderId: orden.id, folio: `TK-${new Date().getFullYear()}-0001`, orderTotal: 1000 });
    const consulta = await consultar(tokens.recepcion, orden.id);
    expect(consulta.status).toBe(200);
    expect(consulta.body.data).toEqual(ticketShape);
  });
});
