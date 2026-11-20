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
  createAppointment,
  createPart
} from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';
import { todayLocal } from '../../services/maintenanceService.js';

const centro = async (token) => (await request(app).get('/api/notifications').set(bearer(token))).body.data;
const grupo = (data, type) => data.groups.find((g) => g.type === type);

// Fecha local (AAAA-MM-DD) a `dias` días de hoy.
const en = (dias) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return todayLocal(fecha);
};

// Fecha y hora local a `dias` días de hoy, al mediodía (queda dentro del día aunque la prueba corra de madrugada).
const citaEn = (dias) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  fecha.setHours(12, 0, 0, 0);
  return fecha;
};

// Cliente con vehículo (a 50 000 km) y una orden de origen para colgar los mantenimientos.
async function escenario() {
  const mecanico = await createMechanic();
  const cliente = await createClient({ name: 'Cliente Uno', phone: '5550000001' });
  const vehiculo = await createVehicle({ clientId: cliente.id, licensePlate: 'REC1001' });
  await pool.query('UPDATE vehicles SET current_mileage = 50000 WHERE id = ?', [vehiculo.id]);
  const orden = await createOrder({ clientId: cliente.id, vehicleId: vehiculo.id, mechanicId: mecanico.id, status: 'ENTREGADO' });
  return { mecanico, cliente, vehiculo, orden };
}

describe('centro de notificaciones de la recepción (mantenimientos y citas)', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('recibe MAINTENANCE_SOON y MAINTENANCE_OVERDUE con los umbrales de 30 días y 1,000 km', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const { vehiculo, orden } = await escenario();
    const crear = (description, extra) => createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, description, ...extra });
    const vencidoFecha = await crear('Vencido por fecha', { dueDate: en(-2) });
    const vencidoKm = await crear('Vencido por km', { dueMileage: 50000 });
    const proximoFecha = await crear('Próximo por fecha', { dueDate: en(30) });
    const proximoKm = await crear('Próximo por km', { dueMileage: 51000 });
    await crear('Normal por fecha', { dueDate: en(31) });
    await crear('Normal por km', { dueMileage: 51001 });

    const data = await centro(token);

    const claves = (type) => grupo(data, type).items.map((a) => a.key).sort();
    expect(grupo(data, 'MAINTENANCE_OVERDUE').total).toBe(2);
    expect(claves('MAINTENANCE_OVERDUE')).toEqual([`MAINT:${vencidoFecha.id}`, `MAINT:${vencidoKm.id}`].sort());
    expect(grupo(data, 'MAINTENANCE_SOON').total).toBe(2);
    expect(claves('MAINTENANCE_SOON')).toEqual([`MAINT:${proximoFecha.id}`, `MAINT:${proximoKm.id}`].sort());
  });

  test('el aviso de mantenimiento trae gravedad, descripción, vehículo, cliente y destino', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const { vehiculo, orden } = await escenario();
    const vencido = await createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, description: 'Cambio de banda', dueDate: en(-1) });
    const proximo = await createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, description: 'Cambio de aceite', dueDate: en(5) });

    const data = await centro(token);

    const avisoVencido = grupo(data, 'MAINTENANCE_OVERDUE').items[0];
    expect(avisoVencido).toMatchObject({
      key: `MAINT:${vencido.id}`,
      type: 'MAINTENANCE_OVERDUE',
      severity: 2,
      read: false,
      target: { module: 'maintenance', id: vencido.id }
    });
    expect(avisoVencido.title).toContain('Cambio de banda');
    expect(avisoVencido.detail).toContain('REC1001');
    expect(avisoVencido.detail).toContain('Cliente Uno');
    expect(grupo(data, 'MAINTENANCE_SOON').items[0]).toMatchObject({
      key: `MAINT:${proximo.id}`,
      type: 'MAINTENANCE_SOON',
      severity: 1,
      target: { module: 'maintenance', id: proximo.id }
    });
  });

  test('los mantenimientos atendidos o cancelados no generan aviso', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const { vehiculo, orden } = await escenario();
    await createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, description: 'Atendido', dueDate: en(-5), status: 'ATENDIDO' });
    await createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, description: 'Cancelado', dueDate: en(-5), status: 'CANCELADO' });

    expect(await centro(token)).toEqual({ unread: 0, groups: [] });
  });

  test('el mantenimiento de un vehículo desactivado no genera aviso', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const { vehiculo, orden } = await escenario();
    await createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, dueDate: en(-5) });
    await pool.query('UPDATE vehicles SET active = 0 WHERE id = ?', [vehiculo.id]);

    expect(await centro(token)).toEqual({ unread: 0, groups: [] });
  });

  test('APPOINTMENT_TODAY solo incluye citas de hoy PENDIENTE o CONFIRMADA', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const { cliente, vehiculo } = await escenario();
    const crear = (scheduledAt, status) => createAppointment({ clientId: cliente.id, vehicleId: vehiculo.id, scheduledAt, status });
    const pendiente = await crear(citaEn(0), 'PENDIENTE');
    const confirmada = await crear(citaEn(0), 'CONFIRMADA');
    await crear(citaEn(0), 'CANCELADA');
    await crear(citaEn(1), 'PENDIENTE');
    await crear(citaEn(-1), 'PENDIENTE');

    const data = await centro(token);

    const claves = grupo(data, 'APPOINTMENT_TODAY').items.map((a) => a.key).sort();
    expect(grupo(data, 'APPOINTMENT_TODAY').total).toBe(2);
    expect(claves).toEqual([`APPT:${pendiente.id}`, `APPT:${confirmada.id}`].sort());
  });

  test('el aviso de cita trae gravedad 1, cliente, vehículo, hora y destino', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const { cliente, vehiculo } = await escenario();
    const cita = await createAppointment({ clientId: cliente.id, vehicleId: vehiculo.id, scheduledAt: citaEn(0), status: 'CONFIRMADA' });

    const aviso = grupo(await centro(token), 'APPOINTMENT_TODAY').items[0];

    expect(aviso).toMatchObject({
      key: `APPT:${cita.id}`,
      type: 'APPOINTMENT_TODAY',
      severity: 1,
      read: false,
      target: { module: 'appointments', id: cita.id }
    });
    expect(aviso.title).toContain('Cliente Uno');
    expect(aviso.detail).toContain('REC1001');
    expect(aviso.detail).toMatch(/12:00/);
  });

  test('el total de APPOINTMENT_TODAY coincide con las citas de hoy PENDIENTE o CONFIRMADA consultadas directamente', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const { cliente, vehiculo } = await escenario();
    for (const status of ['PENDIENTE', 'CONFIRMADA', 'PENDIENTE', 'CANCELADA']) {
      await createAppointment({ clientId: cliente.id, vehicleId: vehiculo.id, scheduledAt: citaEn(0), status });
    }

    const [[directo]] = await pool.query(
      "SELECT COUNT(*) AS total FROM appointments WHERE status IN ('PENDIENTE','CONFIRMADA') AND DATE(scheduled_at) = CURDATE()"
    );

    expect(grupo(await centro(token), 'APPOINTMENT_TODAY').total).toBe(Number(directo.total));
  });

  test('nunca recibe avisos de stock aunque haya refacciones con stock bajo o agotadas', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    await createPart({ code: 'LOW-1', stock: 3, minStock: 3 });
    await createPart({ code: 'OUT-1', stock: 0, minStock: 3 });

    const data = await centro(token);

    expect(data).toEqual({ unread: 0, groups: [] });
    const conteo = await request(app).get('/api/notifications/count').set(bearer(token));
    expect(conteo.body.data.unread).toBe(0);
  });

  test('no puede marcar como leído un aviso de stock (404 NOTIFICATION_NOT_FOUND)', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const parte = await createPart({ code: 'LOW-1', stock: 1, minStock: 3 });

    const res = await request(app).post('/api/notifications/read').set(bearer(token)).send({ key: `STOCK:${parte.id}` });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOTIFICATION_NOT_FOUND');
  });

  test('el contador suma mantenimientos y citas, y coincide con el centro', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const { cliente, vehiculo, orden } = await escenario();
    await createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, description: 'A', dueDate: en(-1) });
    await createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, description: 'B', dueDate: en(3) });
    await createAppointment({ clientId: cliente.id, vehicleId: vehiculo.id, scheduledAt: citaEn(0) });

    const data = await centro(token);
    const conteo = await request(app).get('/api/notifications/count').set(bearer(token));

    expect(data.unread).toBe(3);
    expect(conteo.body.data.unread).toBe(3);
  });

  test('el administrador también recibe los avisos de mantenimientos y citas', async () => {
    const { token } = await loginAs('ADMIN');
    const { cliente, vehiculo, orden } = await escenario();
    await createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, dueDate: en(-1) });
    await createAppointment({ clientId: cliente.id, vehicleId: vehiculo.id, scheduledAt: citaEn(0) });

    const data = await centro(token);

    expect(grupo(data, 'MAINTENANCE_OVERDUE').total).toBe(1);
    expect(grupo(data, 'APPOINTMENT_TODAY').total).toBe(1);
  });

  test('los grupos salen de lo más urgente a lo menos: vencidos, próximos y citas', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const { cliente, vehiculo, orden } = await escenario();
    await createAppointment({ clientId: cliente.id, vehicleId: vehiculo.id, scheduledAt: citaEn(0) });
    await createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, description: 'P', dueDate: en(3) });
    await createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, description: 'V', dueDate: en(-3) });

    const data = await centro(token);

    expect(data.groups.map((g) => g.type)).toEqual(['MAINTENANCE_OVERDUE', 'MAINTENANCE_SOON', 'APPOINTMENT_TODAY']);
  });
});
