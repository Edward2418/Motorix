import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, pool, createPart, createOrderPart } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioPago, registrarPago, cancelarPago } from '../helpers/payments.js';

describe('el panel se calcula al consultar', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  const panel = async (token) => (await request(app).get('/api/dashboard').set(bearer(token))).body.data;

  test('registrar y cancelar un pago cambia lo cobrado y el saldo por cobrar en la siguiente consulta', async () => {
    const { orden, tokens } = await escenarioPago({ total: 1000 });
    expect((await panel(tokens.admin)).indicators.collected).toBe(0);
    expect((await panel(tokens.admin)).attention.pendingBalance.total).toBe(1000);

    const pago = await registrarPago(tokens.recepcion, orden.id, { amount: 400, method: 'EFECTIVO' });
    const despues = await panel(tokens.admin);
    expect(despues.indicators.collected).toBe(400);
    expect(despues.attention.pendingBalance.total).toBe(600);

    await cancelarPago(tokens.admin, pago.body.data.payment.id, { reason: 'Error de captura' });
    const final = await panel(tokens.admin);
    expect(final.indicators.collected).toBe(0);
    expect(final.attention.pendingBalance.total).toBe(1000);
  });

  test('cambiar el estado de una orden o mover el inventario se refleja de inmediato', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'EN_REPARACION', total: 100 });
    const antes = await panel(tokens.admin);
    expect(antes.indicators.vehiclesInRepair).toBe(1);

    await pool.query("UPDATE service_orders SET status = 'TERMINADO' WHERE id = ?", [orden.id]);
    const despues = await panel(tokens.admin);
    expect(despues.indicators.vehiclesInRepair).toBe(0);
    expect(despues.ordersByStatus.find((e) => e.status === 'TERMINADO').count).toBe(1);

    const pieza = await createPart({ code: 'LIVE-1', stock: 4, minStock: 3 });
    expect((await panel(tokens.admin)).indicators.lowStockParts).toBe(0);
    await createOrderPart({ orderId: orden.id, partId: pieza.id, quantity: 2 });
    expect((await panel(tokens.admin)).indicators.lowStockParts).toBe(1);
  });

  test('no existen tablas de estadísticas ni de copias de datos del panel', async () => {
    const [tablas] = await pool.query('SELECT table_name AS nombre FROM information_schema.tables WHERE table_schema = DATABASE()');
    expect(tablas.map((t) => t.nombre.toLowerCase()).sort()).toEqual([
      'appointments',
      'clients',
      'folio_counters',
      'inventory_movements',
      'login_attempts',
      'maintenance',
      'order_labor',
      'order_parts',
      'order_services',
      'order_status_history',
      'parts',
      'payments',
      'schema_migrations',
      'service_orders',
      'ticket_folio_counters',
      'tickets',
      'users',
      'vehicles'
    ]);
  });
});
