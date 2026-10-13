import { resetTables, closePool, pool } from '../helpers/db.js';
import { escenarioPago, registrarPago } from '../helpers/payments.js';

describe('concurrencia al registrar pagos', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('dos pagos simultáneos que juntos superarían el disponible: uno se registra y el otro recibe 409', async () => {
    const { orden, tokens } = await escenarioPago({ total: 1000 });
    const respuestas = await Promise.all([
      registrarPago(tokens.recepcion, orden.id, { amount: 700, method: 'EFECTIVO' }),
      registrarPago(tokens.admin, orden.id, { amount: 700, method: 'TRANSFERENCIA' })
    ]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409]);
    const rechazada = respuestas.find((r) => r.status === 409);
    expect(rechazada.body.error.code).toBe('AMOUNT_EXCEEDS_BALANCE');
    const [[{ suma }]] = await pool.query("SELECT COALESCE(SUM(amount), 0) AS suma FROM payments WHERE order_id = ?", [orden.id]);
    expect(Number(suma)).toBe(700);
  });

  test('varios pagos pequeños simultáneos suman exactamente el total sin pasarse', async () => {
    const { orden, tokens } = await escenarioPago({ total: 1000 });
    const respuestas = await Promise.all(
      Array.from({ length: 8 }, (_, i) => registrarPago(tokens[i % 2 ? 'admin' : 'recepcion'], orden.id, { amount: 200, method: 'EFECTIVO' }))
    );
    expect(respuestas.filter((r) => r.status === 201)).toHaveLength(5);
    expect(respuestas.filter((r) => r.status === 409)).toHaveLength(3);
    const [[{ suma }]] = await pool.query("SELECT SUM(amount) AS suma FROM payments WHERE order_id = ? AND status = 'PAGADO'", [orden.id]);
    expect(Number(suma)).toBe(1000);
  });

  test('un pago y un cambio de servicios simultáneos no dejan la orden inconsistente', async () => {
    const { orden, tokens } = await escenarioPago({ total: 1000 });
    const [pago] = await Promise.all([
      registrarPago(tokens.recepcion, orden.id, { amount: 1000, method: 'EFECTIVO' }),
      pool.query("INSERT INTO order_labor (order_id, description, amount) VALUES (?, 'Mano de obra', 100)", [orden.id])
    ]);
    expect(pago.status).toBe(201);
    const [[{ cobrado }]] = await pool.query("SELECT SUM(amount) AS cobrado FROM payments WHERE order_id = ? AND status = 'PAGADO'", [orden.id]);
    expect(Number(cobrado)).toBe(1000);
  });
});
