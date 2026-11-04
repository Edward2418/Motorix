import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, addServiceLine, createPart, createOrderPart } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';
import { escenarioPago, registrarPago } from '../helpers/payments.js';

afterAll(closePool);

const centavos = (importe) => Math.round(importe * 100);
const agregar = (token, orderId, body) => request(app).post(`/api/orders/${orderId}/parts`).set(bearer(token)).send(body);

describe('total de la orden en centavos enteros', () => {
  beforeEach(resetTables);

  test('una línea de 3 × 33.33 tiene importe exacto 99.99 y el total coincide con la suma de sus líneas', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    await addServiceLine(orden.id, 'Servicio', 850);
    await addServiceLine(orden.id, 'Mano de obra', 450, 'order_labor');
    const bujias = await createPart({ code: 'BUJ-01', stock: 20, salePrice: 33.33 });
    const bateria = await createPart({ code: 'BAT-01', stock: 5, salePrice: 1660.01 });
    await agregar(tokens.mecanico, orden.id, { partId: bujias.id, quantity: 3 });
    const res = await agregar(tokens.mecanico, orden.id, { partId: bateria.id, quantity: 1 });
    expect(res.status).toBe(201);

    const detalle = res.body.data;
    const lineaBujias = detalle.parts.find((linea) => linea.code === 'BUJ-01');
    expect(lineaBujias).toMatchObject({ unitPrice: 33.33, quantity: 3, subtotal: 99.99 });
    expect(detalle).toMatchObject({ servicesTotal: 850, laborTotal: 450, partsTotal: 1760, total: 3060 });

    const sumaDeLineas =
      detalle.parts.reduce((suma, linea) => suma + centavos(linea.subtotal), 0) +
      centavos(850) +
      centavos(450);
    expect(sumaDeLineas).toBe(centavos(detalle.total));
  });

  test('con importes de centavos que suelen dar errores de coma flotante el total sigue siendo exacto', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    await addServiceLine(orden.id, 'Servicio', 0.1);
    await addServiceLine(orden.id, 'Mano de obra', 0.2, 'order_labor');
    const pieza = await createPart({ code: 'TOR-01', stock: 50, salePrice: 0.07 });
    const res = await agregar(tokens.mecanico, orden.id, { partId: pieza.id, quantity: 3 });
    expect(res.body.data).toMatchObject({ servicesTotal: 0.1, laborTotal: 0.2, partsTotal: 0.21, total: 0.51 });
  });
});

describe('orden terminada que solo tiene refacciones', () => {
  beforeEach(resetTables);

  test('es cobrable por su total porque es mayor que cero', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'TERMINADO', total: 0 });
    const pieza = await createPart({ code: 'FIL-01', stock: 10, salePrice: 100 });
    await createOrderPart({ orderId: orden.id, partId: pieza.id, quantity: 2 });

    const res = await registrarPago(tokens.recepcion, orden.id, { amount: 200, method: 'EFECTIVO' });
    expect(res.status).toBe(201);
    expect(res.body.data.summary).toMatchObject({ total: 200, collected: 200, status: 'PAGADA' });
  });

  test('con total cero se rechaza el cobro como hasta ahora', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'TERMINADO', total: 0 });
    const res = await registrarPago(tokens.recepcion, orden.id, { amount: 100, method: 'EFECTIVO' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ORDER_NOT_PAYABLE');
  });
});
