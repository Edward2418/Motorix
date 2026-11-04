import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, addServiceLine, createPart, createOrderPart, createPayment } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';

afterAll(closePool);

const CAMPOS_DE_PAGO = ['payment', 'paymentStatus', 'payments', 'paymentSummary'];
const tieneCamposDePago = (texto) => CAMPOS_DE_PAGO.some((campo) => texto.includes(`"${campo}"`));

describe('lo que ve el mecánico en una orden', () => {
  beforeEach(resetTables);

  test('agrega una refacción y recibe el precio de venta, el importe de las líneas y el total, pero ningún dato de pago', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    await addServiceLine(orden.id, 'Afinación', 500);
    const pieza = await createPart({ code: 'BUJ-01', stock: 10, purchasePrice: 73.41, salePrice: 188.88 });

    const alta = await request(app).post(`/api/orders/${orden.id}/parts`).set(bearer(tokens.mecanico)).send({ partId: pieza.id, quantity: 2 });
    expect(alta.status).toBe(201);
    expect(alta.body.data.parts[0]).toMatchObject({ unitPrice: 188.88, quantity: 2, subtotal: 377.76 });
    expect(alta.body.data).toMatchObject({ partsTotal: 377.76, total: 877.76 });
    expect(tieneCamposDePago(JSON.stringify(alta.body))).toBe(false);

    const detalle = await request(app).get(`/api/orders/${orden.id}`).set(bearer(tokens.mecanico));
    expect(detalle.status).toBe(200);
    expect(detalle.body.data).toMatchObject({ partsTotal: 377.76, total: 877.76 });
    expect(tieneCamposDePago(JSON.stringify(detalle.body))).toBe(false);
    expect(JSON.stringify(detalle.body)).not.toMatch(/purchase/i);
  });

  test('el listado de órdenes del mecánico trae el total pero no el estado de pago', async () => {
    const { orden, tokens } = await escenarioOrden('TERMINADO');
    await addServiceLine(orden.id, 'Servicio', 400);
    const lista = await request(app).get('/api/orders').set(bearer(tokens.mecanico));
    expect(lista.status).toBe(200);
    expect(lista.body.data[0].total).toBe(400);
    expect(lista.body.data[0]).not.toHaveProperty('paymentStatus');
    expect(tieneCamposDePago(JSON.stringify(lista.body))).toBe(false);
  });

  test('las rutas de pagos y de tickets responden 403 al mecánico, sin cambiar nada', async () => {
    const { orden, tokens } = await escenarioOrden('TERMINADO');
    await addServiceLine(orden.id, 'Servicio', 400);
    const pago = await createPayment({ orderId: orden.id, amount: 100, method: 'EFECTIVO' });
    const token = bearer(tokens.mecanico);

    const respuestas = [
      await request(app).get(`/api/orders/${orden.id}/payments`).set(token),
      await request(app).post(`/api/orders/${orden.id}/payments`).set(token).send({ amount: 50, method: 'EFECTIVO' }),
      await request(app).post(`/api/payments/${pago.id}/cancel`).set(token).send({ reason: 'Prueba' }),
      await request(app).post(`/api/payments/${pago.id}/refresh`).set(token),
      await request(app).get('/api/payments/config').set(token),
      await request(app).post(`/api/orders/${orden.id}/ticket`).set(token),
      await request(app).get(`/api/orders/${orden.id}/ticket`).set(token)
    ];
    for (const res of respuestas) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
  });

  test('el inventario que consulta el mecánico trae solo refacciones activas, con precio de venta y sin precio de compra', async () => {
    const { tokens } = await escenarioOrden('EN_REPARACION');
    await createPart({ code: 'ACT-01', stock: 5, purchasePrice: 73.41, salePrice: 188.88 });
    await createPart({ code: 'INA-01', stock: 5, purchasePrice: 10, salePrice: 20, active: false });

    const res = await request(app).get('/api/parts').set(bearer(tokens.mecanico));
    expect(res.status).toBe(200);
    expect(res.body.data.map((parte) => parte.code)).toEqual(['ACT-01']);
    expect(res.body.data[0].salePrice).toBe(188.88);
    expect(res.body.data[0]).not.toHaveProperty('purchasePrice');
  });
});
