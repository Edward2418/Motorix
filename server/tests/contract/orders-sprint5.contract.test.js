import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createPart, addServiceLine, createOrderPart, createPayment } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';

afterAll(closePool);

const errorShape = (code, status, message) => ({
  status,
  body: { error: { code, message: message ?? expect.any(String) } }
});

describe('contrato de los errores nuevos del Sprint 5 en las órdenes', () => {
  beforeEach(resetTables);

  test('409 ORDER_ALREADY_PAID con el formato { error: { code, message } } al cambiar refacciones de una orden cobrada', async () => {
    const { orden, tokens } = await escenarioOrden('TERMINADO');
    await addServiceLine(orden.id, 'Servicio', 1000);
    const pieza = await createPart({ code: 'FIL-01', stock: 10, salePrice: 100 });
    const otra = await createPart({ code: 'BUJ-01', stock: 10, salePrice: 50 });
    await createOrderPart({ orderId: orden.id, partId: pieza.id, quantity: 1 });
    await createPayment({ orderId: orden.id, amount: 1100, method: 'EFECTIVO', status: 'PAGADO' });

    const res = await request(app)
      .post(`/api/orders/${orden.id}/parts`)
      .set(bearer(tokens.admin))
      .send({ partId: otra.id, quantity: 1, reason: 'Corrección' });
    const esperado = errorShape('ORDER_ALREADY_PAID', 409, 'La orden ya está cobrada: no se pueden modificar las refacciones.');
    expect(res.status).toBe(esperado.status);
    expect(res.body).toEqual(esperado.body);
  });

  test('422 ORDER_TOTAL_LIMIT_EXCEEDED al agregar una refacción, un servicio o mano de obra que pasa el máximo', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    await addServiceLine(orden.id, 'Reconstrucción', 99999990);
    const pieza = await createPart({ code: 'FIL-01', stock: 10, salePrice: 100 });

    const pruebas = [
      request(app).post(`/api/orders/${orden.id}/parts`).set(bearer(tokens.mecanico)).send({ partId: pieza.id, quantity: 1 }),
      request(app).post(`/api/orders/${orden.id}/services`).set(bearer(tokens.mecanico)).send({ description: 'Extra', amount: 20 }),
      request(app).post(`/api/orders/${orden.id}/labor`).set(bearer(tokens.mecanico)).send({ description: 'Extra', amount: 20 })
    ];
    for (const prueba of pruebas) {
      const res = await prueba;
      expect(res.status).toBe(422);
      expect(res.body).toEqual({
        error: { code: 'ORDER_TOTAL_LIMIT_EXCEEDED', message: 'El total de la orden no puede superar $99,999,999.99.' }
      });
    }
  });
});
