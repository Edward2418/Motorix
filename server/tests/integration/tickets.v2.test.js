import request from 'supertest';
import app from '../../app.js';
import { env } from '../../config/env.js';
import { pool, resetTables, closePool, addServiceLine, createPart, createOrderPart, createPayment } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioPago, cancelarPago } from '../helpers/payments.js';

afterAll(closePool);

const MOTIVO = 'Corrección de la administración';
const generar = (token, orderId) => request(app).post(`/api/orders/${orderId}/ticket`).set(bearer(token));
const consultar = (token, orderId) => request(app).get(`/api/orders/${orderId}/ticket`).set(bearer(token));
const agregarPieza = (token, orderId, body) => request(app).post(`/api/orders/${orderId}/parts`).set(bearer(token)).send(body);
const quitarPieza = (token, orderId, lineId, body) => request(app).delete(`/api/orders/${orderId}/parts/${lineId}`).set(bearer(token)).send(body);

const contenidoGuardado = async (orderId) => {
  const [[fila]] = await pool.query('SELECT content FROM tickets WHERE order_id = ?', [orderId]);
  return typeof fila.content === 'string' ? JSON.parse(fila.content) : fila.content;
};

// Orden terminada con servicio $800, mano de obra $300 y una refacción (2 × $150). Total: $1,400.
async function ordenConLineas() {
  const escenario = await escenarioPago({ status: 'TERMINADO', total: 800 });
  await addServiceLine(escenario.orden.id, 'Mano de obra de frenos', 300, 'order_labor');
  const pieza = await createPart({ code: 'BAL-01', name: 'Balatas', stock: 10, purchasePrice: 50, salePrice: 150 });
  const linea = await createOrderPart({ orderId: escenario.orden.id, partId: pieza.id, quantity: 2 });
  return { ...escenario, pieza, linea };
}

describe('ticket nuevo: guarda lo emitido', () => {
  beforeEach(resetTables);

  test('al emitirse guarda taller, cliente, vehículo, folio de la orden, líneas, subtotales y total, sin pagos ni estado', async () => {
    const { orden, tokens } = await ordenConLineas();
    await createPayment({ orderId: orden.id, amount: 1000, method: 'TRANSFERENCIA', reference: 'SPEI-1' });

    const res = await generar(tokens.recepcion, orden.id);
    expect(res.status).toBe(201);

    const contenido = await contenidoGuardado(orden.id);
    expect(contenido).toEqual({
      workshop: { name: env.workshop.name, address: env.workshop.address, phone: env.workshop.phone },
      order: { id: orden.id, folio: orden.folio },
      client: { name: 'Ana Pérez', phone: expect.any(String) },
      vehicle: { description: expect.any(String), licensePlate: 'ABC1234', mileage: 1000 },
      services: [{ description: 'Servicio de prueba', quantity: 1, unitPrice: 800, amount: 800 }],
      labor: [{ description: 'Mano de obra de frenos', quantity: 1, unitPrice: 300, amount: 300 }],
      parts: [{ description: 'BAL-01 · Balatas', quantity: 2, unitPrice: 150, amount: 300 }],
      subtotals: { services: 800, labor: 300, parts: 300 },
      total: 1400
    });
    expect(contenido).not.toHaveProperty('payments');
    expect(contenido).not.toHaveProperty('paymentSummary');
    expect(contenido.order).not.toHaveProperty('status');
  });

  test('cambiar el precio de una refacción o las líneas de la orden no cambia lo que muestra el ticket', async () => {
    const { orden, tokens } = await ordenConLineas();
    const emitido = (await generar(tokens.recepcion, orden.id)).body.data;
    expect(emitido.orderChangedSinceGenerated).toBe(false);

    await pool.query('UPDATE order_parts SET unit_price = 999 WHERE order_id = ?', [orden.id]);
    await addServiceLine(orden.id, 'Extra posterior', 200, 'order_labor');

    const consulta = (await consultar(tokens.recepcion, orden.id)).body.data;
    expect(consulta.services).toEqual(emitido.services);
    expect(consulta.labor).toEqual(emitido.labor);
    expect(consulta.parts).toEqual(emitido.parts);
    expect(consulta.subtotals).toEqual(emitido.subtotals);
    expect(consulta.total).toBe(1400);
    expect(consulta.orderChangedSinceGenerated).toBe(true);
  });

  test('cambiar el nombre del cliente o la placa después no cambia el ticket', async () => {
    const { orden, client, vehicle, tokens } = await ordenConLineas();
    await generar(tokens.recepcion, orden.id);
    await pool.query("UPDATE clients SET name = 'Otro Nombre' WHERE id = ?", [client.id]);
    await pool.query("UPDATE vehicles SET license_plate = 'ZZZ9999' WHERE id = ?", [vehicle.id]);

    const consulta = (await consultar(tokens.recepcion, orden.id)).body.data;
    expect(consulta.client.name).toBe('Ana Pérez');
    expect(consulta.vehicle.licensePlate).toBe('ABC1234');
  });

  test('los pagos y su estado se muestran vigentes aunque el ticket guarde lo demás', async () => {
    const { orden, tokens } = await ordenConLineas();
    const emitido = (await generar(tokens.recepcion, orden.id)).body.data;
    expect(emitido.payments).toEqual([]);
    expect(emitido.paymentSummary.status).toBe('SIN_PAGO');

    await createPayment({ orderId: orden.id, amount: 500, method: 'EFECTIVO' });
    const consulta = (await consultar(tokens.recepcion, orden.id)).body.data;
    expect(consulta.payments.map((p) => [p.method, p.status, p.amount])).toEqual([['EFECTIVO', 'PAGADO', 500]]);
    expect(consulta.paymentSummary).toMatchObject({ total: 1400, collected: 500, balance: 900, status: 'PARCIAL' });
    // El total no cambió, así que no hay aviso de orden modificada.
    expect(consulta.orderChangedSinceGenerated).toBe(false);
  });

  test('repetir la generación devuelve el mismo ticket sin volver a guardar el contenido', async () => {
    const { orden, tokens } = await ordenConLineas();
    const primero = await generar(tokens.recepcion, orden.id);
    const guardado = await contenidoGuardado(orden.id);
    await addServiceLine(orden.id, 'Extra posterior', 200, 'order_labor');

    const segundo = await generar(tokens.admin, orden.id);
    expect(segundo.status).toBe(200);
    expect(segundo.body.data.id).toBe(primero.body.data.id);
    expect(await contenidoGuardado(orden.id)).toEqual(guardado);
  });
});

describe('ticket emitido y refacciones que cambian después', () => {
  beforeEach(resetTables);

  test('sin un pago cobrado, la administración cambia las refacciones y el ticket muestra lo emitido con el aviso', async () => {
    const { orden, linea, tokens } = await ordenConLineas();
    const emitido = (await generar(tokens.recepcion, orden.id)).body.data;
    const otra = await createPart({ code: 'BUJ-01', name: 'Bujía', stock: 10, purchasePrice: 20, salePrice: 80 });

    expect((await agregarPieza(tokens.admin, orden.id, { partId: otra.id, quantity: 1, reason: MOTIVO })).status).toBe(201);
    expect((await quitarPieza(tokens.admin, orden.id, linea.id, { reason: MOTIVO })).status).toBe(200);

    const consulta = (await consultar(tokens.recepcion, orden.id)).body.data;
    expect(consulta.parts).toEqual(emitido.parts);
    expect(consulta.total).toBe(emitido.total);
    expect(consulta.orderChangedSinceGenerated).toBe(true);
  });

  test('si la administración cancela el pago cobrado y cambia las refacciones, el ticket sigue mostrando lo emitido con el aviso', async () => {
    const { orden, linea, tokens } = await ordenConLineas();
    const cobro = await request(app)
      .post(`/api/orders/${orden.id}/payments`)
      .set(bearer(tokens.recepcion))
      .send({ amount: 1400, method: 'EFECTIVO' });
    expect(cobro.status).toBe(201);
    const emitido = (await generar(tokens.recepcion, orden.id)).body.data;

    expect((await cancelarPago(tokens.admin, cobro.body.data.payment.id, { reason: 'Se cobró por error' })).status).toBe(200);
    expect((await quitarPieza(tokens.admin, orden.id, linea.id, { reason: MOTIVO })).status).toBe(200);

    const consulta = (await consultar(tokens.recepcion, orden.id)).body.data;
    expect(consulta.parts).toEqual(emitido.parts);
    expect(consulta.total).toBe(1400);
    expect(consulta.orderChangedSinceGenerated).toBe(true);
  });

  test('una refacción con precio de venta cero aparece en el ticket con importe $0.00', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'TERMINADO', total: 500 });
    const cortesia = await createPart({ code: 'CORT-01', name: 'Cortesía', stock: 5, purchasePrice: 0, salePrice: 0 });
    await createOrderPart({ orderId: orden.id, partId: cortesia.id, quantity: 1 });

    const ticket = (await generar(tokens.recepcion, orden.id)).body.data;
    expect(ticket.parts).toEqual([{ description: 'CORT-01 · Cortesía', quantity: 1, unitPrice: 0, amount: 0 }]);
    expect(ticket.subtotals.parts).toBe(0);
    expect(ticket.total).toBe(500);
  });

  test('una refacción desactivada después de emitir el ticket no cambia lo que este muestra', async () => {
    const { orden, pieza, tokens } = await ordenConLineas();
    const emitido = (await generar(tokens.recepcion, orden.id)).body.data;
    await pool.query('UPDATE parts SET active = 0, name = ? WHERE id = ?', ['Nombre nuevo', pieza.id]);

    const consulta = (await consultar(tokens.recepcion, orden.id)).body.data;
    expect(consulta.parts).toEqual(emitido.parts);
  });
});
