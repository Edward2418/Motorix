import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createClient, createVehicle, createAppointment } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

const enDias = (dias) => new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
const enMinutos = (minutos) => new Date(Date.now() + minutos * 60 * 1000);

const crear = (token, body) => request(app).post('/api/appointments').set(bearer(token)).send(body);
const editar = (token, id, body) => request(app).put(`/api/appointments/${id}`).set(bearer(token)).send(body);
const confirmar = (token, id) => request(app).post(`/api/appointments/${id}/confirm`).set(bearer(token));
const cancelar = (token, id, body = {}) => request(app).post(`/api/appointments/${id}/cancel`).set(bearer(token)).send(body);

async function base() {
  const recepcion = await loginAs('RECEPTIONIST');
  const client = await createClient({ name: 'Ana Pérez' });
  const vehicle = await createVehicle({ clientId: client.id, licensePlate: 'ABC1234' });
  const datos = (extra = {}) => ({
    clientId: client.id,
    vehicleId: vehicle.id,
    scheduledAt: enDias(2).toISOString(),
    reason: 'Revisión general',
    ...extra
  });
  return { recepcion, client, vehicle, datos };
}

afterAll(closePool);

describe('citas: registro', () => {
  beforeEach(resetTables);

  test('registra una cita PENDIENTE con motivo y observaciones', async () => {
    const { recepcion, datos } = await base();
    const res = await crear(recepcion.token, datos({ reason: '  Afinación mayor ', notes: ' Traer llave de repuesto ' }));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      status: 'PENDIENTE',
      reason: 'Afinación mayor',
      notes: 'Traer llave de repuesto',
      clientName: 'Ana Pérez',
      orderId: null
    });
  });

  test('el administrador también puede registrar citas y las observaciones son opcionales', async () => {
    const { datos } = await base();
    const admin = await loginAs('ADMIN');
    const res = await crear(admin.token, datos());
    expect(res.status).toBe(201);
    expect(res.body.data.notes).toBeNull();
  });

  test('rechaza un cliente o un vehículo inexistente, desactivado o que no es del cliente', async () => {
    const { recepcion, client, vehicle, datos } = await base();
    expect((await crear(recepcion.token, datos({ clientId: 9999 }))).status).toBe(400);
    expect((await crear(recepcion.token, datos({ vehicleId: 9999 }))).status).toBe(400);

    const otro = await createClient({ name: 'Otro', phone: '5598765432' });
    expect((await crear(recepcion.token, datos({ clientId: otro.id }))).status).toBe(400);

    await pool.query('UPDATE vehicles SET active = 0 WHERE id = ?', [vehicle.id]);
    expect((await crear(recepcion.token, datos())).status).toBe(409);
    await pool.query('UPDATE vehicles SET active = 1 WHERE id = ?', [vehicle.id]);
    await pool.query('UPDATE clients SET active = 0 WHERE id = ?', [client.id]);
    expect((await crear(recepcion.token, datos())).status).toBe(409);
  });

  test('rechaza una fecha pasada, tolera hasta 5 minutos y acepta una fecha futura', async () => {
    const { recepcion, datos } = await base();
    expect((await crear(recepcion.token, datos({ scheduledAt: enDias(-1).toISOString() }))).status).toBe(400);
    expect((await crear(recepcion.token, datos({ scheduledAt: enMinutos(-10).toISOString() }))).status).toBe(400);
    expect((await crear(recepcion.token, datos({ scheduledAt: enMinutos(-2).toISOString() }))).status).toBe(201);
    expect((await crear(recepcion.token, datos({ scheduledAt: enDias(30).toISOString() }))).status).toBe(201);
  });

  test('valida la fecha y hora: obligatoria y en formato ISO 8601', async () => {
    const { recepcion, datos } = await base();
    for (const invalida of [undefined, '', 'mañana', '2030-13-45T10:00:00Z', 12345, '2030-01-15']) {
      const res = await crear(recepcion.token, datos({ scheduledAt: invalida }));
      expect({ valor: String(invalida), status: res.status }).toEqual({ valor: String(invalida), status: 400 });
      expect(res.body.error.details.map((d) => d.field)).toContain('scheduledAt');
    }
  });

  test('el motivo es obligatorio (hasta 255 caracteres) y las observaciones admiten hasta 1000', async () => {
    const { recepcion, datos } = await base();
    expect((await crear(recepcion.token, datos({ reason: '' }))).status).toBe(400);
    expect((await crear(recepcion.token, datos({ reason: 'x'.repeat(256) }))).status).toBe(400);
    expect((await crear(recepcion.token, datos({ reason: 'x'.repeat(255), scheduledAt: enDias(3).toISOString() }))).status).toBe(201);
    expect((await crear(recepcion.token, datos({ notes: 'x'.repeat(1001), scheduledAt: enDias(4).toISOString() }))).status).toBe(400);
    expect((await crear(recepcion.token, datos({ notes: 'x'.repeat(1000), scheduledAt: enDias(5).toISOString() }))).status).toBe(201);
  });

  test('una segunda cita activa del mismo vehículo a la misma hora responde 409, salvo que la anterior esté cancelada', async () => {
    const { recepcion, datos } = await base();
    const hora = enDias(3).toISOString();
    const primera = await crear(recepcion.token, datos({ scheduledAt: hora }));
    expect((await crear(recepcion.token, datos({ scheduledAt: hora }))).status).toBe(409);

    await cancelar(recepcion.token, primera.body.data.id);
    expect((await crear(recepcion.token, datos({ scheduledAt: hora }))).status).toBe(201);
  });

  test('una cita enviada con una zona horaria distinta se guarda y se devuelve con la misma hora', async () => {
    const { recepcion, datos } = await base();
    const res = await crear(recepcion.token, datos({ scheduledAt: '2031-01-15T10:30:00-06:00' }));
    expect(res.status).toBe(201);
    expect(new Date(res.body.data.scheduledAt).toISOString()).toBe('2031-01-15T16:30:00.000Z');

    const lectura = await request(app).get(`/api/appointments/${res.body.data.id}`).set(bearer(recepcion.token));
    expect(new Date(lectura.body.data.scheduledAt).toISOString()).toBe('2031-01-15T16:30:00.000Z');
  });
});

describe('citas: modificar, confirmar y cancelar', () => {
  beforeEach(resetTables);

  test('modifica fecha, hora, motivo y observaciones sin cambiar cliente ni vehículo', async () => {
    const { recepcion, client, vehicle } = await base();
    const cita = await createAppointment({ clientId: client.id, vehicleId: vehicle.id, status: 'CONFIRMADA' });
    const nueva = enDias(7);
    const res = await editar(recepcion.token, cita.id, {
      scheduledAt: nueva.toISOString(),
      reason: 'Cambio de frenos',
      notes: 'Revisar discos',
      clientId: 999,
      vehicleId: 999
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ reason: 'Cambio de frenos', notes: 'Revisar discos', clientId: client.id, vehicleId: vehicle.id });
    expect(new Date(res.body.data.scheduledAt).getTime()).toBeCloseTo(nueva.getTime(), -4);
  });

  test('solo se modifica en PENDIENTE y CONFIRMADA (409 en otro estado)', async () => {
    const { recepcion, client, vehicle } = await base();
    for (const estado of ['EN_PROCESO', 'COMPLETADA', 'CANCELADA']) {
      const cita = await createAppointment({ clientId: client.id, vehicleId: vehicle.id, status: estado, scheduledAt: enDias(10 + estado.length) });
      const res = await editar(recepcion.token, cita.id, { scheduledAt: enDias(20).toISOString(), reason: 'Nuevo' });
      expect({ estado, status: res.status }).toEqual({ estado, status: 409 });
    }
  });

  test('modificar valida lo mismo que registrar: fecha futura, motivo y duplicados', async () => {
    const { recepcion, client, vehicle } = await base();
    const cita = await createAppointment({ clientId: client.id, vehicleId: vehicle.id });
    const horaOtra = new Date(Math.floor(enDias(9).getTime() / 1000) * 1000);
    const otra = await createAppointment({ clientId: client.id, vehicleId: vehicle.id, scheduledAt: horaOtra });
    otra.scheduledAt = horaOtra;

    expect((await editar(recepcion.token, cita.id, { scheduledAt: enDias(-1).toISOString(), reason: 'X' })).status).toBe(400);
    expect((await editar(recepcion.token, cita.id, { scheduledAt: enDias(8).toISOString(), reason: '' })).status).toBe(400);
    // Mismo vehículo y misma hora que otra cita activa: choque. Su propia hora no cuenta como choque.
    const choque = await editar(recepcion.token, cita.id, { scheduledAt: otra.scheduledAt.toISOString(), reason: 'X' });
    expect(choque.status).toBe(409);
    expect((await editar(recepcion.token, cita.id, { scheduledAt: enDias(2).toISOString(), reason: 'Mismo día' })).status).toBe(200);
  });

  test('confirma solo desde PENDIENTE', async () => {
    const { recepcion, client, vehicle } = await base();
    const pendiente = await createAppointment({ clientId: client.id, vehicleId: vehicle.id });
    expect((await confirmar(recepcion.token, pendiente.id)).body.data.status).toBe('CONFIRMADA');
    expect((await confirmar(recepcion.token, pendiente.id)).status).toBe(409);

    for (const estado of ['EN_PROCESO', 'COMPLETADA', 'CANCELADA']) {
      const cita = await createAppointment({ clientId: client.id, vehicleId: vehicle.id, status: estado, scheduledAt: enDias(10 + estado.length) });
      expect((await confirmar(recepcion.token, cita.id)).status).toBe(409);
    }
  });

  test('cancela PENDIENTE o CONFIRMADA con y sin motivo, y conserva el registro', async () => {
    const { recepcion, client, vehicle } = await base();
    const a = await createAppointment({ clientId: client.id, vehicleId: vehicle.id, status: 'PENDIENTE' });
    const b = await createAppointment({ clientId: client.id, vehicleId: vehicle.id, status: 'CONFIRMADA', scheduledAt: enDias(8) });

    const conMotivo = await cancelar(recepcion.token, a.id, { reason: 'No puede asistir' });
    expect(conMotivo.body.data).toMatchObject({ status: 'CANCELADA', cancelReason: 'No puede asistir' });
    const sinMotivo = await cancelar(recepcion.token, b.id);
    expect(sinMotivo.body.data).toMatchObject({ status: 'CANCELADA', cancelReason: null });

    const [filas] = await pool.query('SELECT COUNT(*) AS total FROM appointments');
    expect(filas[0].total).toBe(2);
    expect((await request(app).get(`/api/appointments/${a.id}`).set(bearer(recepcion.token))).status).toBe(200);
  });

  test('no cancela una cita EN_PROCESO, COMPLETADA o ya CANCELADA (409)', async () => {
    const { recepcion, client, vehicle } = await base();
    for (const estado of ['EN_PROCESO', 'COMPLETADA', 'CANCELADA']) {
      const cita = await createAppointment({ clientId: client.id, vehicleId: vehicle.id, status: estado, scheduledAt: enDias(10 + estado.length) });
      expect({ estado, status: (await cancelar(recepcion.token, cita.id)).status }).toEqual({ estado, status: 409 });
    }
  });

  test('el motivo de cancelación admite hasta 255 caracteres', async () => {
    const { recepcion, client, vehicle } = await base();
    const cita = await createAppointment({ clientId: client.id, vehicleId: vehicle.id });
    expect((await cancelar(recepcion.token, cita.id, { reason: 'x'.repeat(256) })).status).toBe(400);
    expect((await cancelar(recepcion.token, cita.id, { reason: 'x'.repeat(255) })).status).toBe(200);
  });
});

describe('citas: consulta y permisos', () => {
  beforeEach(resetTables);

  test('filtra por fechas (ambas inclusive), estado y cliente, ordenado por fecha y hora', async () => {
    const { recepcion, client, vehicle } = await base();
    const otro = await createClient({ name: 'Luis Gómez', phone: '5522222222' });
    const vehiculoOtro = await createVehicle({ clientId: otro.id, licensePlate: 'LUI0001' });
    await createAppointment({ clientId: client.id, vehicleId: vehicle.id, scheduledAt: new Date(2035, 2, 1, 10, 0), reason: 'Primera' });
    await createAppointment({ clientId: client.id, vehicleId: vehicle.id, scheduledAt: new Date(2035, 2, 1, 16, 0), reason: 'Segunda', status: 'CONFIRMADA' });
    await createAppointment({ clientId: otro.id, vehicleId: vehiculoOtro.id, scheduledAt: new Date(2035, 2, 3, 9, 0), reason: 'Tercera' });

    const listar = (query) => request(app).get(`/api/appointments${query}`).set(bearer(recepcion.token));

    const porDia = await listar('?from=2035-03-01&to=2035-03-01');
    expect(porDia.body.data.map((c) => c.reason)).toEqual(['Primera', 'Segunda']);

    const desde = await listar('?from=2035-03-02');
    expect(desde.body.data.map((c) => c.reason)).toEqual(['Tercera']);

    const porEstado = await listar('?status=CONFIRMADA');
    expect(porEstado.body.data.map((c) => c.reason)).toEqual(['Segunda']);

    const porCliente = await listar(`?clientId=${otro.id}`);
    expect(porCliente.body.data.map((c) => c.reason)).toEqual(['Tercera']);

    const todas = await listar('');
    expect(todas.body.data.map((c) => c.reason)).toEqual(['Primera', 'Segunda', 'Tercera']);
  });

  test('pagina y rechaza parámetros inválidos', async () => {
    const { recepcion, client, vehicle } = await base();
    for (let i = 0; i < 5; i++) {
      await createAppointment({ clientId: client.id, vehicleId: vehicle.id, scheduledAt: enDias(i + 1), reason: `Cita ${i}` });
    }
    const pagina = await request(app).get('/api/appointments?pageSize=2&page=2').set(bearer(recepcion.token));
    expect(pagina.body.meta).toEqual({ page: 2, pageSize: 2, total: 5 });
    expect(pagina.body.data.map((c) => c.reason)).toEqual(['Cita 2', 'Cita 3']);

    for (const consulta of ['?pageSize=500', '?from=ayer', '?to=2030-02-30x', '?status=INVENTADO', '?clientId=abc']) {
      expect({ consulta, status: (await request(app).get(`/api/appointments${consulta}`).set(bearer(recepcion.token))).status }).toEqual({
        consulta,
        status: 400
      });
    }
  });

  test('el mecánico recibe 403 en todas las rutas de citas y sin token responde 401', async () => {
    const { client, vehicle } = await base();
    const cita = await createAppointment({ clientId: client.id, vehicleId: vehicle.id });
    const mecanico = await loginAs('MECHANIC', { username: 'mec.sesion' });
    const t = mecanico.token;

    expect((await request(app).get('/api/appointments').set(bearer(t))).status).toBe(403);
    expect((await request(app).get(`/api/appointments/${cita.id}`).set(bearer(t))).status).toBe(403);
    expect((await crear(t, { clientId: client.id, vehicleId: vehicle.id, scheduledAt: enDias(2).toISOString(), reason: 'X' })).status).toBe(403);
    expect((await editar(t, cita.id, { scheduledAt: enDias(3).toISOString(), reason: 'X' })).status).toBe(403);
    expect((await confirmar(t, cita.id)).status).toBe(403);
    expect((await cancelar(t, cita.id)).status).toBe(403);
    expect((await request(app).get('/api/appointments')).status).toBe(401);
  });

  test('una cita inexistente responde 404 y un identificador inválido 400', async () => {
    const { recepcion } = await base();
    expect((await request(app).get('/api/appointments/9999').set(bearer(recepcion.token))).status).toBe(404);
    expect((await confirmar(recepcion.token, 9999)).status).toBe(404);
    expect((await cancelar(recepcion.token, 9999)).status).toBe(404);
    expect((await request(app).get('/api/appointments/abc').set(bearer(recepcion.token))).status).toBe(400);
  });

  test('no existe ninguna ruta para eliminar citas', async () => {
    const { recepcion, client, vehicle } = await base();
    const cita = await createAppointment({ clientId: client.id, vehicleId: vehicle.id });
    expect((await request(app).delete(`/api/appointments/${cita.id}`).set(bearer(recepcion.token))).status).toBe(404);
  });
});
