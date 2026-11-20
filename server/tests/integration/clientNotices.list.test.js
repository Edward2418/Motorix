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
  createClientNotice
} from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';
import { todayLocal } from '../../services/maintenanceService.js';

beforeEach(async () => {
  placa = 0;
  await resetTables();
});
afterAll(closePool);

const listar = async (token) => (await request(app).get('/api/client-notices').set(bearer(token))).body;
const por = (lista, reason) => lista.data.filter((n) => n.reason === reason);

const en = (dias) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return todayLocal(fecha);
};
const citaEn = (dias) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  fecha.setHours(12, 0, 0, 0);
  return fecha;
};

let placa = 0;
// Cada hecho usa su propio vehículo: la base permite una sola orden abierta por vehículo.
async function vehiculoNuevo(cliente) {
  placa += 1;
  const vehiculo = await createVehicle({ clientId: cliente.id, licensePlate: `LIS${6000 + placa}` });
  await pool.query('UPDATE vehicles SET current_mileage = 50000 WHERE id = ?', [vehiculo.id]);
  return vehiculo;
}

async function base() {
  const mecanico = await createMechanic();
  const cliente = await createClient({ name: 'Cliente Lista', phone: '5550002222' });
  return { mecanico, cliente };
}

describe('lista de clientes por avisar', () => {
  test('aparece una orden TERMINADO sin entregar con su clave ORDER:id', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const b = await base();
    const vehiculo = await vehiculoNuevo(b.cliente);
    const orden = await createOrder({ clientId: b.cliente.id, vehicleId: vehiculo.id, mechanicId: b.mecanico.id, status: 'TERMINADO' });

    const lista = await listar(token);

    expect(por(lista, 'ORDEN_TERMINADA')).toHaveLength(1);
    expect(por(lista, 'ORDEN_TERMINADA')[0]).toMatchObject({ factKey: `ORDER:${orden.id}`, clientId: b.cliente.id, clientName: 'Cliente Lista' });
    expect(por(lista, 'ORDEN_TERMINADA')[0].detail).toContain(orden.folio);
  });

  test('una orden ENTREGADO o en proceso no aparece', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const b = await base();
    for (const status of ['ENTREGADO', 'EN_REPARACION', 'CANCELADA']) {
      const vehiculo = await vehiculoNuevo(b.cliente);
      await createOrder({ clientId: b.cliente.id, vehicleId: vehiculo.id, mechanicId: b.mecanico.id, status });
    }
    expect((await listar(token)).data).toEqual([]);
  });

  test('aparece una cita de mañana PENDIENTE o CONFIRMADA; una cancelada, una de hoy o una de pasado mañana no', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const b = await base();
    const vehiculo = await vehiculoNuevo(b.cliente);
    const crear = (dias, status) => createAppointment({ clientId: b.cliente.id, vehicleId: vehiculo.id, scheduledAt: citaEn(dias), status });
    const pendiente = await crear(1, 'PENDIENTE');
    const confirmada = await crear(1, 'CONFIRMADA');
    await crear(1, 'CANCELADA');
    await crear(0, 'PENDIENTE');
    await crear(2, 'PENDIENTE');

    const lista = await listar(token);

    expect(por(lista, 'CITA_MANANA').map((n) => n.factKey).sort()).toEqual([`APPT:${pendiente.id}`, `APPT:${confirmada.id}`].sort());
  });

  test('aparecen los mantenimientos PROGRAMADO próximos y vencidos, con su motivo', async () => {
    const { token } = await loginAs('ADMIN');
    const b = await base();
    const vehiculo = await vehiculoNuevo(b.cliente);
    const orden = await createOrder({ clientId: b.cliente.id, vehicleId: vehiculo.id, mechanicId: b.mecanico.id, status: 'ENTREGADO' });
    const crear = (description, extra) => createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, description, ...extra });
    const vencido = await crear('Vencido', { dueDate: en(-3) });
    const proximo = await crear('Próximo', { dueDate: en(10) });
    await crear('Normal', { dueDate: en(100) });
    await crear('Atendido', { dueDate: en(-8), status: 'ATENDIDO' });

    const lista = await listar(token);

    expect(por(lista, 'MANTENIMIENTO_VENCIDO').map((n) => n.factKey)).toEqual([`MAINT:${vencido.id}`]);
    expect(por(lista, 'MANTENIMIENTO_PROXIMO').map((n) => n.factKey)).toEqual([`MAINT:${proximo.id}`]);
    expect(lista.meta.total).toBe(2);
  });

  test('un hecho ya avisado no aparece', async () => {
    const { token, user } = await loginAs('RECEPTIONIST');
    const b = await base();
    const v1 = await vehiculoNuevo(b.cliente);
    const v2 = await vehiculoNuevo(b.cliente);
    const avisada = await createOrder({ clientId: b.cliente.id, vehicleId: v1.id, mechanicId: b.mecanico.id, status: 'TERMINADO' });
    const pendiente = await createOrder({ clientId: b.cliente.id, vehicleId: v2.id, mechanicId: b.mecanico.id, status: 'TERMINADO' });
    await createClientNotice({ clientId: b.cliente.id, reason: 'ORDEN_TERMINADA', factKey: `ORDER:${avisada.id}`, notifiedBy: user.id });

    const lista = await listar(token);

    expect(lista.data.map((n) => n.factKey)).toEqual([`ORDER:${pendiente.id}`]);
  });

  test('un mantenimiento avisado como próximo vuelve a aparecer cuando pasa a vencido (otro motivo)', async () => {
    const { token, user } = await loginAs('RECEPTIONIST');
    const b = await base();
    const vehiculo = await vehiculoNuevo(b.cliente);
    const orden = await createOrder({ clientId: b.cliente.id, vehicleId: vehiculo.id, mechanicId: b.mecanico.id, status: 'ENTREGADO' });
    const mantenimiento = await createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, dueDate: en(-2) });
    await createClientNotice({
      clientId: b.cliente.id,
      reason: 'MANTENIMIENTO_PROXIMO',
      factKey: `MAINT:${mantenimiento.id}`,
      notifiedBy: user.id
    });

    const lista = await listar(token);

    expect(por(lista, 'MANTENIMIENTO_VENCIDO').map((n) => n.factKey)).toEqual([`MAINT:${mantenimiento.id}`]);
  });

  test('cada elemento trae el teléfono del cliente, o «Sin teléfono» si llegara vacío', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const b = await base();
    const sinTelefono = await createClient({ name: 'Cliente Sin Teléfono', phone: '5550003333' });
    await pool.query("UPDATE clients SET phone = '' WHERE id = ?", [sinTelefono.id]);
    const v1 = await vehiculoNuevo(b.cliente);
    const v2 = await vehiculoNuevo(sinTelefono);
    await createOrder({ clientId: b.cliente.id, vehicleId: v1.id, mechanicId: b.mecanico.id, status: 'TERMINADO' });
    await createOrder({ clientId: sinTelefono.id, vehicleId: v2.id, mechanicId: b.mecanico.id, status: 'TERMINADO' });

    const lista = await listar(token);

    const telefono = Object.fromEntries(lista.data.map((n) => [n.clientName, n.phone]));
    expect(telefono).toEqual({ 'Cliente Lista': '5550002222', 'Cliente Sin Teléfono': 'Sin teléfono' });
  });

  test('administración y recepción ven la misma lista', async () => {
    const b = await base();
    const vehiculo = await vehiculoNuevo(b.cliente);
    await createOrder({ clientId: b.cliente.id, vehicleId: vehiculo.id, mechanicId: b.mecanico.id, status: 'TERMINADO' });
    const admin = await loginAs('ADMIN');
    const recepcion = await loginAs('RECEPTIONIST');

    expect((await listar(admin.token)).meta.total).toBe(1);
    expect((await listar(recepcion.token)).meta.total).toBe(1);
  });
});
