import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, pool } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioPago, registrarPago } from '../helpers/payments.js';

describe('métodos de pago', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('efectivo, tarjeta y transferencia quedan cobrados de inmediato con su referencia opcional', async () => {
    const { orden, tokens } = await escenarioPago({ total: 1000 });
    const casos = [
      ['EFECTIVO', null],
      ['TARJETA', 'AUT-884213'],
      ['TRANSFERENCIA', 'SPEI-20261013-0042']
    ];
    for (const [method, reference] of casos) {
      const res = await registrarPago(tokens.recepcion, orden.id, { amount: 100, method, ...(reference ? { reference } : {}) });
      expect({ method, status: res.status }).toEqual({ method, status: 201 });
      expect(res.body.data.payment).toMatchObject({ method, status: 'PAGADO', reference });
    }
    const [filas] = await pool.query('SELECT method, status, reference FROM payments WHERE order_id = ? ORDER BY id', [orden.id]);
    expect(filas.map((f) => f.method)).toEqual(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA']);
    expect(filas.map((f) => f.reference)).toEqual([null, 'AUT-884213', 'SPEI-20261013-0042']);
  });

  test('un método ausente o desconocido responde 400', async () => {
    const { orden, tokens } = await escenarioPago();
    for (const body of [{ amount: 10 }, { amount: 10, method: 'BITCOIN' }, { amount: 10, method: 'efectivo' }]) {
      const res = await registrarPago(tokens.recepcion, orden.id, body);
      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d) => d.field)).toContain('method');
    }
  });

  test('una referencia con forma de número de tarjeta responde 400 y no se guarda nada', async () => {
    const { orden, tokens } = await escenarioPago();
    const res = await registrarPago(tokens.recepcion, orden.id, { amount: 10, method: 'TARJETA', reference: '4111 1111 1111 1111' });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0]).toMatchObject({ field: 'reference' });
    expect(JSON.stringify(res.body)).not.toContain('4111');
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM payments');
    expect(total).toBe(0);
  });

  test('los campos de tarjeta del cuerpo no se almacenan ni se devuelven', async () => {
    const { orden, tokens } = await escenarioPago();
    const res = await registrarPago(tokens.recepcion, orden.id, {
      amount: 10,
      method: 'TARJETA',
      cardNumber: '4111111111111111',
      cvv: '123',
      expiry: '12/30'
    });
    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toMatch(/4111|cvv|expiry|12\/30/i);
    const [[fila]] = await pool.query('SELECT * FROM payments WHERE id = ?', [res.body.data.payment.id]);
    expect(JSON.stringify(fila)).not.toMatch(/4111|123|12\/30/);
  });

  test('GET /payments/config informa los cuatro métodos y que Mercado Pago no está configurado', async () => {
    const { tokens } = await escenarioPago();
    for (const rol of ['admin', 'recepcion']) {
      const res = await request(app).get('/api/payments/config').set(bearer(tokens[rol]));
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        methods: ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'MERCADO_PAGO'],
        mercadoPagoEnabled: false
      });
    }
  });

  test('GET /payments/config no está permitido al mecánico ni sin sesión', async () => {
    const { tokens } = await escenarioPago();
    expect((await request(app).get('/api/payments/config').set(bearer(tokens.mecanico))).status).toBe(403);
    expect((await request(app).get('/api/payments/config')).status).toBe(401);
  });
});
