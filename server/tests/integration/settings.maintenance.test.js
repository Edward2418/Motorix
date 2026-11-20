import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createMaintenance, createSetting } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';
import { todayLocal } from '../../services/maintenanceService.js';

beforeEach(resetTables);
afterAll(closePool);

// Fecha local (AAAA-MM-DD) a `dias` días de hoy.
const en = (dias) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return todayLocal(fecha);
};

const guardar = (token, cuerpo) => request(app).put('/api/settings').set(bearer(token)).send(cuerpo);
const leerConfiguracion = async (token) => (await request(app).get('/api/settings').set(bearer(token))).body.data;
const listar = (token, visualStatus) =>
  request(app).get(`/api/maintenance?status=PROGRAMADO&visualStatus=${visualStatus}`).set(bearer(token));
const panel = async (token) => (await request(app).get('/api/dashboard').set(bearer(token))).body.data;
const avisos = async (token) => (await request(app).get('/api/notifications').set(bearer(token))).body.data;
const programar = (token, orderId, cuerpo) => request(app).post(`/api/orders/${orderId}/maintenance`).set(bearer(token)).send(cuerpo);

const totalDeAviso = (centro, tipo) => centro.groups.find((g) => g.type === tipo)?.total ?? 0;

// Una orden entregada con su vehículo (a 50,000 km) para colgar los mantenimientos.
async function escenario() {
  const datos = await escenarioOrden('ENTREGADO');
  await pool.query('UPDATE vehicles SET current_mileage = 50000 WHERE id = ?', [datos.vehicle.id]);
  return datos;
}

const crear = (datos, descripcion, extra) =>
  createMaintenance({ vehicleId: datos.vehicle.id, orderId: datos.orden.id, description: descripcion, ...extra });

describe('márgenes de «Próximo» configurables', () => {
  test('al bajar el margen de 30 a 15 días, un mantenimiento a 20 días deja de ser «Próximo» en la lista, el panel y los avisos', async () => {
    const datos = await escenario();
    await crear(datos, 'A 20 días', { dueDate: en(20) });
    const { admin } = datos.tokens;
    expect((await listar(admin, 'PROXIMO')).body.meta.total).toBe(1);
    expect((await panel(admin)).attention.maintenance.soon).toBe(1);
    expect(totalDeAviso(await avisos(admin), 'MAINTENANCE_SOON')).toBe(1);

    const res = await guardar(admin, { maintenance: { soonDays: 15 } });

    expect(res.status).toBe(200);
    expect((await listar(admin, 'PROXIMO')).body.meta.total).toBe(0);
    expect((await listar(admin, 'NORMAL')).body.meta.total).toBe(1);
    expect((await panel(admin)).attention.maintenance.soon).toBe(0);
    expect(totalDeAviso(await avisos(admin), 'MAINTENANCE_SOON')).toBe(0);
  });

  test('al subir el margen a 45 días, un mantenimiento a 40 días pasa a «Próximo» en las tres vistas', async () => {
    const datos = await escenario();
    await crear(datos, 'A 40 días', { dueDate: en(40) });
    const { admin } = datos.tokens;
    expect((await listar(admin, 'PROXIMO')).body.meta.total).toBe(0);

    await guardar(admin, { maintenance: { soonDays: 45 } });

    expect((await listar(admin, 'PROXIMO')).body.meta.total).toBe(1);
    expect((await panel(admin)).attention.maintenance.soon).toBe(1);
    expect(totalDeAviso(await avisos(admin), 'MAINTENANCE_SOON')).toBe(1);
  });

  test('el margen en kilómetros también cambia las tres vistas', async () => {
    const datos = await escenario();
    await crear(datos, 'A 1,500 km', { dueMileage: 51500 });
    const { admin } = datos.tokens;
    expect((await listar(admin, 'PROXIMO')).body.meta.total).toBe(0);

    await guardar(admin, { maintenance: { soonKm: 2000 } });

    expect((await listar(admin, 'PROXIMO')).body.meta.total).toBe(1);
    expect((await panel(admin)).attention.maintenance.soon).toBe(1);
    expect(totalDeAviso(await avisos(admin), 'MAINTENANCE_SOON')).toBe(1);
  });

  test('un mantenimiento vencido sigue vencido sea cual sea el margen', async () => {
    const datos = await escenario();
    await crear(datos, 'Vencido', { dueDate: en(-3) });
    const { admin } = datos.tokens;

    await guardar(admin, { maintenance: { soonDays: 1 } });

    expect((await listar(admin, 'VENCIDO')).body.meta.total).toBe(1);
    expect((await panel(admin)).attention.maintenance.overdue).toBe(1);
  });

  test('la respuesta de programar un mantenimiento usa el margen guardado', async () => {
    const datos = await escenario();
    await pool.query("UPDATE service_orders SET status = 'EN_REPARACION' WHERE id = ?", [datos.orden.id]);
    const antes = await programar(datos.tokens.admin, datos.orden.id, { description: 'Con margen de 30', dueDate: en(20) });
    expect(antes.body.data.visualStatus).toBe('PROXIMO');

    await guardar(datos.tokens.admin, { maintenance: { soonDays: 15 } });
    const despues = await programar(datos.tokens.admin, datos.orden.id, { description: 'Con margen de 15', dueDate: en(20) });

    expect(despues.status).toBe(201);
    expect(despues.body.data.visualStatus).toBe('NORMAL');
  });

  test('el detalle de la orden muestra el estado visual de sus mantenimientos con el margen guardado', async () => {
    const datos = await escenario();
    await crear(datos, 'A 20 días', { dueDate: en(20) });
    await guardar(datos.tokens.admin, { maintenance: { soonDays: 15 } });

    const detalle = await request(app).get(`/api/orders/${datos.orden.id}`).set(bearer(datos.tokens.admin));

    expect(detalle.body.data.maintenance[0].visualStatus).toBe('NORMAL');
  });
});

describe('valores de respaldo', () => {
  test('sin nada guardado se usan 30 días y 1,000 km (una instalación existente sigue funcionando)', async () => {
    const datos = await escenario();
    await crear(datos, 'A 30 días', { dueDate: en(30) });
    await crear(datos, 'A 31 días', { dueDate: en(31) });
    await crear(datos, 'A 1,000 km', { dueMileage: 51000 });
    await crear(datos, 'A 1,001 km', { dueMileage: 51001 });
    const { admin } = datos.tokens;

    const configuracion = await leerConfiguracion(admin);

    expect(configuracion.maintenance).toMatchObject({ soonDays: 30, soonKm: 1000 });
    expect(['environment', 'default']).toContain(configuracion.maintenance.source);
    expect((await listar(admin, 'PROXIMO')).body.meta.total).toBe(2);
    expect((await listar(admin, 'NORMAL')).body.meta.total).toBe(2);
  });

  test.each([['0'], ['abc'], ['366'], ['1.5'], ['']])('un valor guardado inválido (%p) se ignora y se usa el respaldo', async (valor) => {
    const datos = await escenario();
    await crear(datos, 'A 20 días', { dueDate: en(20) });
    const [[usuario]] = await pool.query('SELECT id FROM users LIMIT 1');
    await createSetting({ key: 'maintenance_soon_days', value: valor, updatedBy: usuario.id });

    const configuracion = await leerConfiguracion(datos.tokens.admin);

    expect(configuracion.maintenance.soonDays).toBe(30);
    expect(configuracion.maintenance.source).not.toBe('saved');
    expect((await listar(datos.tokens.admin, 'PROXIMO')).body.meta.total).toBe(1);
  });

  test('tras guardar, el origen de los márgenes pasa a «saved»', async () => {
    const { tokens } = await escenario();

    const res = await guardar(tokens.admin, { maintenance: { soonDays: 20, soonKm: 2500 } });

    expect(res.body.data.maintenance).toEqual({ soonDays: 20, soonKm: 2500, source: 'saved' });
  });
});

describe('validación de los márgenes', () => {
  test.each([
    ['0 días', { soonDays: 0 }, 'maintenance.soonDays'],
    ['366 días', { soonDays: 366 }, 'maintenance.soonDays'],
    ['-5 días', { soonDays: -5 }, 'maintenance.soonDays'],
    ['1.5 días', { soonDays: 1.5 }, 'maintenance.soonDays'],
    ['«abc» días', { soonDays: 'abc' }, 'maintenance.soonDays'],
    ['99 km', { soonKm: 99 }, 'maintenance.soonKm'],
    ['50,001 km', { soonKm: 50001 }, 'maintenance.soonKm'],
    ['1000.5 km', { soonKm: 1000.5 }, 'maintenance.soonKm']
  ])('rechaza %s con 400 VALIDATION_ERROR y el detalle por campo', async (_nombre, grupo, campo) => {
    const { tokens } = await escenario();

    const res = await guardar(tokens.admin, { maintenance: grupo });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toContain(campo);
  });

  test('los límites exactos se aceptan (1 y 365 días, 100 y 50,000 km)', async () => {
    const { tokens } = await escenario();
    expect((await guardar(tokens.admin, { maintenance: { soonDays: 1, soonKm: 100 } })).status).toBe(200);
    expect((await guardar(tokens.admin, { maintenance: { soonDays: 365, soonKm: 50000 } })).status).toBe(200);
  });

  test('un campo desconocido del grupo se rechaza', async () => {
    const { tokens } = await escenario();
    const res = await guardar(tokens.admin, { maintenance: { soonWeeks: 2 } });
    expect(res.status).toBe(400);
  });

  test('se pueden guardar los datos del taller y los márgenes en una sola petición', async () => {
    const { tokens } = await escenario();

    const res = await guardar(tokens.admin, { workshop: { name: 'Taller Conjunto' }, maintenance: { soonDays: 10 } });

    expect(res.status).toBe(200);
    expect(res.body.data.workshop.name).toBe('Taller Conjunto');
    expect(res.body.data.maintenance.soonDays).toBe(10);
  });

  test('si un margen es inválido no se guarda ningún otro dato (todo o nada)', async () => {
    const { tokens } = await escenario();

    const res = await guardar(tokens.admin, { workshop: { name: 'No debe guardarse' }, maintenance: { soonKm: 5 } });

    expect(res.status).toBe(400);
    const configuracion = await leerConfiguracion(tokens.admin);
    expect(configuracion.workshop.name).not.toBe('No debe guardarse');
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM settings');
    expect(Number(total)).toBe(0);
  });

  test('recepción y mecánico no pueden cambiar los márgenes (403)', async () => {
    const { tokens } = await escenario();
    for (const token of [tokens.recepcion, tokens.mecanico]) {
      const res = await guardar(token, { maintenance: { soonDays: 5 } });
      expect(res.status).toBe(403);
    }
    expect((await leerConfiguracion(tokens.admin)).maintenance.soonDays).toBe(30);
  });
});
