import request from 'supertest';
import app from '../../app.js';
import { env } from '../../config/env.js';
import {
  resetTables,
  closePool,
  pool,
  addServiceLine,
  createPart,
  createOrderPart,
  createPayment,
  createTicket
} from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioPago } from '../helpers/payments.js';

const generar = (token, orderId) => request(app).post(`/api/orders/${orderId}/ticket`).set(bearer(token));
const consultar = (token, orderId) => request(app).get(`/api/orders/${orderId}/ticket`).set(bearer(token));
const anio = new Date().getFullYear();

describe('tickets de servicio', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('el ticket trae folio, taller, cliente, vehículo, líneas, subtotales, total y pagos', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'ENTREGADO', total: 800 });
    await addServiceLine(orden.id, 'Mano de obra de frenos', 300, 'order_labor');
    const pieza = await createPart({ code: 'BAL-01', name: 'Balatas', stock: 10, salePrice: 150 });
    await createOrderPart({ orderId: orden.id, partId: pieza.id, quantity: 2 });
    await createPayment({ orderId: orden.id, amount: 1000, method: 'TRANSFERENCIA', reference: 'SPEI-1' });
    await createPayment({ orderId: orden.id, amount: 200, method: 'MERCADO_PAGO', status: 'PENDIENTE' });
    await createPayment({ orderId: orden.id, amount: 50, status: 'RECHAZADO', method: 'MERCADO_PAGO' });
    await createPayment({ orderId: orden.id, amount: 70, status: 'CANCELADO' });

    const res = await generar(tokens.recepcion, orden.id);
    expect(res.status).toBe(201);
    const ticket = res.body.data;
    expect(ticket.folio).toBe(`TK-${anio}-0001`);
    expect(ticket.workshop).toEqual({ name: env.workshop.name, address: env.workshop.address, phone: env.workshop.phone });
    expect(ticket.order).toMatchObject({ id: orden.id, folio: orden.folio, status: 'ENTREGADO' });
    expect(ticket.client).toEqual({ name: 'Ana Pérez', phone: expect.any(String) });
    expect(ticket.vehicle).toMatchObject({ licensePlate: 'ABC1234', mileage: 1000 });
    expect(ticket.vehicle.description).toEqual(expect.any(String));
    expect(ticket.services).toEqual([{ description: 'Servicio de prueba', quantity: 1, unitPrice: 800, amount: 800 }]);
    expect(ticket.labor).toEqual([{ description: 'Mano de obra de frenos', quantity: 1, unitPrice: 300, amount: 300 }]);
    expect(ticket.parts).toEqual([{ description: 'BAL-01 · Balatas', quantity: 2, unitPrice: 150, amount: 300 }]);
    expect(ticket.subtotals).toEqual({ services: 800, labor: 300, parts: 300 });
    expect(ticket.total).toBe(1400);
    // Solo los cobros pagados y pendientes: los rechazados y cancelados no aparecen.
    expect(ticket.payments.map((p) => [p.method, p.status, p.amount])).toEqual([
      ['MERCADO_PAGO', 'PENDIENTE', 200],
      ['TRANSFERENCIA', 'PAGADO', 1000]
    ]);
    expect(ticket.paymentSummary).toMatchObject({ total: 1400, collected: 1000, reserved: 200, balance: 400, status: 'PARCIAL' });
  });

  test('sin kilometraje de servicio, el ticket usa el de entrada', async () => {
    const { orden, tokens } = await escenarioPago();
    expect((await generar(tokens.recepcion, orden.id)).body.data.vehicle.mileage).toBe(1000);
  });

  test('con kilometraje de servicio, el ticket lo muestra', async () => {
    const { orden, tokens } = await escenarioPago();
    await pool.query('UPDATE service_orders SET service_mileage = 1250 WHERE id = ?', [orden.id]);
    expect((await generar(tokens.recepcion, orden.id)).body.data.vehicle.mileage).toBe(1250);
  });

  test('una orden sin pagos se emite SIN_PAGO y una con total cero también se permite', async () => {
    const sinPagos = await escenarioPago({ total: 500 });
    const res = await generar(sinPagos.tokens.recepcion, sinPagos.orden.id);
    expect(res.status).toBe(201);
    expect(res.body.data.payments).toEqual([]);
    expect(res.body.data.paymentSummary.status).toBe('SIN_PAGO');

    await resetTables();
    const cero = await escenarioPago({ total: 0 });
    const vacio = await generar(cero.tokens.admin, cero.orden.id);
    expect(vacio.status).toBe(201);
    expect(vacio.body.data.total).toBe(0);
  });

  test('una orden abierta o cancelada responde 409 ORDER_NOT_TICKETABLE', async () => {
    for (const status of ['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION', 'CANCELADA']) {
      await resetTables();
      const { orden, tokens } = await escenarioPago({ status });
      const res = await generar(tokens.recepcion, orden.id);
      expect({ status, http: res.status, code: res.body.error?.code }).toEqual({ status, http: 409, code: 'ORDER_NOT_TICKETABLE' });
    }
  });

  test('repetir la generación devuelve el mismo folio con estado 200', async () => {
    const { orden, tokens } = await escenarioPago();
    const primero = await generar(tokens.recepcion, orden.id);
    const segundo = await generar(tokens.admin, orden.id);
    expect(primero.status).toBe(201);
    expect(segundo.status).toBe(200);
    expect(segundo.body.data.folio).toBe(primero.body.data.folio);
    expect(segundo.body.data.id).toBe(primero.body.data.id);
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM tickets');
    expect(total).toBe(1);
  });

  test('los folios son consecutivos por año', async () => {
    const folios = [];
    for (let i = 0; i < 3; i += 1) {
      await resetTables();
      const { orden, tokens } = await escenarioPago();
      if (i > 0) {
        await pool.query('INSERT INTO ticket_folio_counters (year, last_number) VALUES (?, ?)', [anio, i]);
      }
      folios.push((await generar(tokens.recepcion, orden.id)).body.data.folio);
    }
    expect(folios).toEqual([`TK-${anio}-0001`, `TK-${anio}-0002`, `TK-${anio}-0003`]);
  });

  test('avisa si la orden cambió después de generar el ticket y muestra los datos vigentes', async () => {
    const { orden, tokens } = await escenarioPago({ total: 1000 });
    const creado = await generar(tokens.recepcion, orden.id);
    expect(creado.body.data.orderChangedSinceGenerated).toBe(false);

    const pieza = await createPart({ code: 'REF-X', stock: 5, salePrice: 100 });
    await createOrderPart({ orderId: orden.id, partId: pieza.id, quantity: 1 });

    const consulta = await consultar(tokens.recepcion, orden.id);
    expect(consulta.status).toBe(200);
    expect(consulta.body.data.folio).toBe(creado.body.data.folio);
    expect(consulta.body.data.orderChangedSinceGenerated).toBe(true);
    expect(consulta.body.data.total).toBe(1100);
    expect(consulta.body.data.parts).toHaveLength(1);
  });

  test('sigue disponible si el cliente o el vehículo se desactivan después', async () => {
    const { orden, client, vehicle, tokens } = await escenarioPago();
    await generar(tokens.recepcion, orden.id);
    await pool.query('UPDATE clients SET active = 0 WHERE id = ?', [client.id]);
    await pool.query('UPDATE vehicles SET active = 0 WHERE id = ?', [vehicle.id]);
    const res = await consultar(tokens.recepcion, orden.id);
    expect(res.status).toBe(200);
    expect(res.body.data.client.name).toBe('Ana Pérez');
  });

  test('administración y recepción pueden; el mecánico recibe 403 y sin sesión 401', async () => {
    const { orden, tokens } = await escenarioPago();
    expect((await generar(tokens.admin, orden.id)).status).toBe(201);
    expect((await consultar(tokens.recepcion, orden.id)).status).toBe(200);
    for (const rol of ['mecanico', 'otro']) {
      expect((await generar(tokens[rol], orden.id)).status).toBe(403);
      expect((await consultar(tokens[rol], orden.id)).status).toBe(403);
    }
    expect((await request(app).post(`/api/orders/${orden.id}/ticket`)).status).toBe(401);
  });

  test('no se puede eliminar un ticket y la base impide un segundo ticket para la misma orden', async () => {
    const { orden, tokens } = await escenarioPago();
    await generar(tokens.recepcion, orden.id);
    for (const metodo of ['delete', 'put', 'patch']) {
      const res = await request(app)[metodo](`/api/orders/${orden.id}/ticket`).set(bearer(tokens.admin));
      expect({ metodo, status: res.status }).toEqual({ metodo, status: 404 });
    }
    await expect(createTicket({ orderId: orden.id, folio: 'TK-9999-0001', orderTotal: 0 })).rejects.toMatchObject({
      code: 'ER_DUP_ENTRY'
    });
    await expect(pool.query('DELETE FROM service_orders WHERE id = ?', [orden.id])).rejects.toMatchObject({
      code: 'ER_ROW_IS_REFERENCED_2'
    });
  });
});
