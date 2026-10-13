import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createClient, createVehicle, createMechanic, createOrder, createMaintenance } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';
import { listMaintenance, todayLocal } from '../../services/maintenanceService.js';

afterAll(closePool);

// Fecha local (AAAA-MM-DD) a `dias` días de hoy.
const en = (dias) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return todayLocal(fecha);
};

const listar = (token, consulta = '') => request(app).get(`/api/maintenance${consulta}`).set(bearer(token));
const descripciones = (res) => res.body.data.map((m) => m.description);

// Un cliente con un vehículo (a 50 000 km) y una orden de origen; cada llamada crea otro vehículo.
async function vehiculoConOrden(base, indice = 1, { kilometraje = 50000, cliente } = {}) {
  const propietario = cliente ?? (await createClient({ name: `Cliente ${indice}`, phone: `55000000${indice}` }));
  const vehiculo = await createVehicle({ clientId: propietario.id, licensePlate: `LIS${1000 + indice}` });
  await pool.query('UPDATE vehicles SET current_mileage = ? WHERE id = ?', [kilometraje, vehiculo.id]);
  const orden = await createOrder({ clientId: propietario.id, vehicleId: vehiculo.id, mechanicId: base.mecanico.id, status: 'ENTREGADO' });
  return { cliente: propietario, vehiculo, orden };
}

async function base() {
  const mecanico = await createMechanic();
  const recepcion = await loginAs('RECEPTIONIST');
  return { mecanico, recepcion };
}

describe('consulta de mantenimientos', () => {
  beforeEach(resetTables);

  test('clasifica por fecha: pasada es VENCIDO, hasta 30 días PROXIMO y después NORMAL', async () => {
    const b = await base();
    const { vehiculo, orden } = await vehiculoConOrden(b);
    const crear = (descripcion, dias) => createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, description: descripcion, dueDate: en(dias) });
    await crear('Pasado', -5);
    await crear('Hoy', 0);
    await crear('Treinta', 30);
    await crear('Treinta y uno', 31);

    const res = await listar(b.recepcion.token);
    const estado = Object.fromEntries(res.body.data.map((m) => [m.description, m.visualStatus]));
    expect(estado).toEqual({ Pasado: 'VENCIDO', Hoy: 'PROXIMO', Treinta: 'PROXIMO', 'Treinta y uno': 'NORMAL' });
    const hoy = res.body.data.find((m) => m.description === 'Hoy');
    expect(hoy.remainingDays).toBe(0);
    expect(res.body.data.find((m) => m.description === 'Pasado').remainingDays).toBe(-5);
  });

  test('clasifica por kilometraje: alcanzado es VENCIDO, a 1000 km o menos PROXIMO y después NORMAL', async () => {
    const b = await base();
    const { vehiculo, orden } = await vehiculoConOrden(b);
    const crear = (descripcion, km) => createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, description: descripcion, dueMileage: km });
    await crear('Alcanzado', 50000);
    await crear('Superado', 49000);
    await crear('Cerca', 50500);
    await crear('Límite', 51000);
    await crear('Lejos', 51001);

    const res = await listar(b.recepcion.token);
    const estado = Object.fromEntries(res.body.data.map((m) => [m.description, m.visualStatus]));
    expect(estado).toEqual({ Alcanzado: 'VENCIDO', Superado: 'VENCIDO', Cerca: 'PROXIMO', Límite: 'PROXIMO', Lejos: 'NORMAL' });
    expect(res.body.data.find((m) => m.description === 'Superado').remainingKm).toBe(-1000);
  });

  test('con fecha y kilometraje manda el más grave', async () => {
    const b = await base();
    const { vehiculo, orden } = await vehiculoConOrden(b);
    await createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, description: 'Fecha lejana, km alcanzado', dueDate: en(200), dueMileage: 50000 });
    await createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, description: 'Km lejano, fecha cerca', dueDate: en(10), dueMileage: 90000 });
    await createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, description: 'Ambos lejanos', dueDate: en(200), dueMileage: 90000 });

    const res = await listar(b.recepcion.token);
    const estado = Object.fromEntries(res.body.data.map((m) => [m.description, m.visualStatus]));
    expect(estado).toEqual({ 'Fecha lejana, km alcanzado': 'VENCIDO', 'Km lejano, fecha cerca': 'PROXIMO', 'Ambos lejanos': 'NORMAL' });
  });

  test('al subir el kilometraje del vehículo el estado se recalcula sin tocar el registro', async () => {
    const b = await base();
    const { vehiculo, orden } = await vehiculoConOrden(b);
    await createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, description: 'Frenos', dueMileage: 52000 });
    const estadoCon = async (km) => {
      await pool.query('UPDATE vehicles SET current_mileage = ? WHERE id = ?', [km, vehiculo.id]);
      return (await listar(b.recepcion.token)).body.data[0].visualStatus;
    };

    expect(await estadoCon(50000)).toBe('NORMAL');
    expect(await estadoCon(51500)).toBe('PROXIMO');
    expect(await estadoCon(52000)).toBe('VENCIDO');
    expect((await pool.query('SELECT due_mileage FROM maintenance'))[0][0].due_mileage).toBe(52000);
  });

  test('ordena vencidos, luego próximos y luego normales, con los más urgentes primero', async () => {
    const b = await base();
    const { vehiculo, orden } = await vehiculoConOrden(b);
    const crear = (descripcion, dias) => createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, description: descripcion, dueDate: en(dias) });
    await crear('Normal 90', 90);
    await crear('Próximo 20', 20);
    await crear('Vencido -2', -2);
    await crear('Normal 40', 40);
    await crear('Vencido -10', -10);
    await crear('Próximo 5', 5);

    const res = await listar(b.recepcion.token);
    expect(descripciones(res)).toEqual(['Vencido -10', 'Vencido -2', 'Próximo 5', 'Próximo 20', 'Normal 40', 'Normal 90']);
  });

  test('por defecto muestra solo los pendientes; status lista los atendidos y los cancelados', async () => {
    const b = await base();
    const { vehiculo, orden } = await vehiculoConOrden(b);
    await createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, description: 'Pendiente', dueDate: en(10) });
    await createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, description: 'Atendido', dueDate: en(10), status: 'ATENDIDO' });
    await createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, description: 'Cancelado', dueDate: en(10), status: 'CANCELADO' });

    expect(descripciones(await listar(b.recepcion.token))).toEqual(['Pendiente']);
    const atendidos = await listar(b.recepcion.token, '?status=ATENDIDO');
    expect(descripciones(atendidos)).toEqual(['Atendido']);
    expect(atendidos.body.data[0]).toMatchObject({ status: 'ATENDIDO', visualStatus: null, remainingDays: null, remainingKm: null });
    expect(descripciones(await listar(b.recepcion.token, '?status=CANCELADO'))).toEqual(['Cancelado']);
  });

  test('filtra por estado visual, cliente, vehículo y búsqueda por placa, descripción o cliente', async () => {
    const b = await base();
    const uno = await vehiculoConOrden(b, 1);
    const dos = await vehiculoConOrden(b, 2);
    await createMaintenance({ vehicleId: uno.vehiculo.id, orderId: uno.orden.id, description: 'Aceite uno', dueDate: en(-3) });
    await createMaintenance({ vehicleId: uno.vehiculo.id, orderId: uno.orden.id, description: 'Frenos uno', dueDate: en(100) });
    await createMaintenance({ vehicleId: dos.vehiculo.id, orderId: dos.orden.id, description: 'Aceite dos', dueDate: en(10) });

    expect(descripciones(await listar(b.recepcion.token, '?visualStatus=VENCIDO'))).toEqual(['Aceite uno']);
    expect(descripciones(await listar(b.recepcion.token, '?visualStatus=PROXIMO'))).toEqual(['Aceite dos']);
    expect(descripciones(await listar(b.recepcion.token, `?clientId=${dos.cliente.id}`))).toEqual(['Aceite dos']);
    expect(descripciones(await listar(b.recepcion.token, `?vehicleId=${uno.vehiculo.id}`)).sort()).toEqual(['Aceite uno', 'Frenos uno']);
    expect(descripciones(await listar(b.recepcion.token, '?q=LIS1002'))).toEqual(['Aceite dos']);
    expect(descripciones(await listar(b.recepcion.token, '?q=frenos'))).toEqual(['Frenos uno']);
    expect(descripciones(await listar(b.recepcion.token, '?q=Cliente%202'))).toEqual(['Aceite dos']);
    expect(descripciones(await listar(b.recepcion.token, '?q=zzz'))).toEqual([]);
  });

  test('pagina sobre el resultado ya ordenado', async () => {
    const b = await base();
    const { vehiculo, orden } = await vehiculoConOrden(b);
    for (let i = 1; i <= 5; i += 1) {
      await createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, description: `Servicio ${i}`, dueDate: en(100 + i) });
    }
    await createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, description: 'Urgente', dueDate: en(-1) });

    const primera = await listar(b.recepcion.token, '?pageSize=4&page=1');
    const segunda = await listar(b.recepcion.token, '?pageSize=4&page=2');
    expect(primera.body.meta).toEqual({ page: 1, pageSize: 4, total: 6 });
    expect(descripciones(primera)).toEqual(['Urgente', 'Servicio 1', 'Servicio 2', 'Servicio 3']);
    expect(descripciones(segunda)).toEqual(['Servicio 4', 'Servicio 5']);
  });

  test('los pendientes de un vehículo desactivado no aparecen', async () => {
    const b = await base();
    const { vehiculo, orden } = await vehiculoConOrden(b);
    await createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, description: 'Aceite', dueDate: en(10) });
    const admin = await loginAs('ADMIN');
    await request(app).patch(`/api/vehicles/${vehiculo.id}/status`).set(bearer(admin.token)).send({ active: false });

    expect(descripciones(await listar(b.recepcion.token))).toEqual([]);
  });

  test('incluye cliente, teléfono, vehículo y orden de origen', async () => {
    const b = await base();
    const { cliente, vehiculo, orden } = await vehiculoConOrden(b, 1);
    await createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, description: 'Aceite', dueDate: en(10), dueMileage: 51000 });

    const [m] = (await listar(b.recepcion.token)).body.data;
    expect(m).toMatchObject({
      clientId: cliente.id,
      clientName: 'Cliente 1',
      clientPhone: '550000001',
      vehicleId: vehiculo.id,
      orderId: orden.id,
      orderFolio: orden.folio,
      currentMileage: 50000,
      dueDate: en(10),
      dueMileage: 51000
    });
    expect(m.vehicleLabel).toContain('LIS1001');
  });

  test('administración, recepción y mecánico pueden consultar; sin sesión no', async () => {
    const b = await base();
    const { vehiculo, orden } = await vehiculoConOrden(b);
    await createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, description: 'Aceite', dueDate: en(10) });

    for (const rol of ['ADMIN', 'RECEPTIONIST', 'MECHANIC']) {
      const { token } = await loginAs(rol, { username: `consulta.${rol.toLowerCase()}` });
      const res = await listar(token);
      expect({ rol, status: res.status, total: res.body.meta?.total }).toEqual({ rol, status: 200, total: 1 });
    }
    expect((await request(app).get('/api/maintenance')).status).toBe(401);
  });

  test('los umbrales se pueden ajustar: con 3 días y 100 km un vencimiento a 10 días es NORMAL', async () => {
    const b = await base();
    const { vehiculo, orden } = await vehiculoConOrden(b);
    await createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, description: 'Aceite', dueDate: en(10) });
    await createMaintenance({ vehicleId: vehiculo.id, orderId: orden.id, description: 'Frenos', dueMileage: 50300 });

    const filtros = { status: 'PROGRAMADO', q: '', page: 1, pageSize: 20 };
    const estrechos = await listMaintenance(filtros, { thresholds: { soonDays: 3, soonKm: 100 } });
    expect(estrechos.data.map((m) => m.visualStatus)).toEqual(['NORMAL', 'NORMAL']);
    const amplios = await listMaintenance(filtros, { thresholds: { soonDays: 15, soonKm: 500 } });
    expect(amplios.data.map((m) => m.visualStatus)).toEqual(['PROXIMO', 'PROXIMO']);
  });
});
