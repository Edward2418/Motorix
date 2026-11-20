import request from 'supertest';
import app from '../../app.js';
import {
  pool,
  resetTables,
  closePool,
  createClient,
  createVehicle,
  createMechanic,
  createOrder,
  createMaintenance,
  createPart
} from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';
import { todayLocal } from '../../services/maintenanceService.js';

const en = (dias) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return todayLocal(fecha);
};

const total = (data, type) => data.groups.find((g) => g.type === type)?.total ?? 0;

// Mismos datos para las tres fuentes: avisos, panel y listado de Mantenimientos (SC-002).
describe('coherencia de las cifras con el panel y con Mantenimientos', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  async function sembrar() {
    const mecanico = await createMechanic();
    const cliente = await createClient({ name: 'Cliente Coherente', phone: '5550000002' });
    const vehiculo = await createVehicle({ clientId: cliente.id, licensePlate: 'COH2001' });
    await pool.query('UPDATE vehicles SET current_mileage = 80000 WHERE id = ?', [vehiculo.id]);
    const orden = await createOrder({ clientId: cliente.id, vehicleId: vehiculo.id, mechanicId: mecanico.id, status: 'ENTREGADO' });
    const crear = (description, extra) => createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, description, ...extra });
    await crear('Vencido 1', { dueDate: en(-4) });
    await crear('Vencido 2', { dueMileage: 79000 });
    await crear('Vencido 3', { dueDate: en(-1) });
    await crear('Próximo 1', { dueDate: en(7) });
    await crear('Próximo 2', { dueMileage: 80900 });
    await crear('Normal', { dueDate: en(120) });
    await crear('Atendido', { dueDate: en(-9), status: 'ATENDIDO' });
    await createPart({ code: 'LOW-1', stock: 3, minStock: 3 });
    await createPart({ code: 'LOW-2', stock: 1, minStock: 3 });
    await createPart({ code: 'OUT-1', stock: 0, minStock: 3 });
  }

  test('los totales de mantenimientos vencidos y próximos coinciden con el panel', async () => {
    await sembrar();
    const { token } = await loginAs('ADMIN');

    const avisos = (await request(app).get('/api/notifications').set(bearer(token))).body.data;
    const panel = (await request(app).get('/api/dashboard').set(bearer(token))).body.data;

    expect(total(avisos, 'MAINTENANCE_OVERDUE')).toBe(3);
    expect(total(avisos, 'MAINTENANCE_SOON')).toBe(2);
    expect(total(avisos, 'MAINTENANCE_OVERDUE')).toBe(panel.attention.maintenance.overdue);
    expect(total(avisos, 'MAINTENANCE_SOON')).toBe(panel.attention.maintenance.soon);
  });

  test('los totales de mantenimientos coinciden con el listado de Mantenimientos', async () => {
    await sembrar();
    const { token } = await loginAs('ADMIN');

    const avisos = (await request(app).get('/api/notifications').set(bearer(token))).body.data;
    const vencidos = await request(app).get('/api/maintenance?status=PROGRAMADO&visualStatus=VENCIDO').set(bearer(token));
    const proximos = await request(app).get('/api/maintenance?status=PROGRAMADO&visualStatus=PROXIMO').set(bearer(token));

    expect(total(avisos, 'MAINTENANCE_OVERDUE')).toBe(vencidos.body.meta.total);
    expect(total(avisos, 'MAINTENANCE_SOON')).toBe(proximos.body.meta.total);
  });

  test('la suma de STOCK_LOW y STOCK_OUT coincide con las refacciones por reponer del panel', async () => {
    await sembrar();
    const { token } = await loginAs('ADMIN');

    const avisos = (await request(app).get('/api/notifications').set(bearer(token))).body.data;
    const panel = (await request(app).get('/api/dashboard').set(bearer(token))).body.data;

    expect(total(avisos, 'STOCK_LOW') + total(avisos, 'STOCK_OUT')).toBe(3);
    expect(total(avisos, 'STOCK_LOW') + total(avisos, 'STOCK_OUT')).toBe(panel.indicators.lowStockParts);
  });

  test('las cifras de recepción en mantenimientos son las mismas que las del administrador', async () => {
    await sembrar();
    const admin = await loginAs('ADMIN');
    const recepcion = await loginAs('RECEPTIONIST');

    const deAdmin = (await request(app).get('/api/notifications').set(bearer(admin.token))).body.data;
    const deRecepcion = (await request(app).get('/api/notifications').set(bearer(recepcion.token))).body.data;

    expect(total(deRecepcion, 'MAINTENANCE_OVERDUE')).toBe(total(deAdmin, 'MAINTENANCE_OVERDUE'));
    expect(total(deRecepcion, 'MAINTENANCE_SOON')).toBe(total(deAdmin, 'MAINTENANCE_SOON'));
  });
});
