import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createClient, createVehicle } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

describe('clientes: registrar y consultar', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('registra un cliente con datos válidos y lo normaliza', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const res = await request(app)
      .post('/api/clients')
      .set(bearer(token))
      .send({ name: '  Ana Pérez  ', phone: '+52 (55) 1234-5678', email: ' ANA@Correo.COM ' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Ana Pérez');
    expect(res.body.data.email).toBe('ana@correo.com');
    expect(res.body.data.active).toBe(true);
  });

  test('el administrador también puede registrar clientes y el correo es opcional', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await request(app).post('/api/clients').set(bearer(token)).send({ name: 'Pedro', phone: '5512345678' });
    expect(res.status).toBe(201);
    expect(res.body.data.email).toBeNull();
  });

  test('exige nombre y teléfono', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const res = await request(app).post('/api/clients').set(bearer(token)).send({});
    expect(res.status).toBe(400);
    const campos = res.body.error.details.map((detalle) => detalle.field);
    expect(campos).toEqual(expect.arrayContaining(['name', 'phone']));
  });

  test('rechaza correo y teléfono con formato inválido', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const res = await request(app)
      .post('/api/clients')
      .set(bearer(token))
      .send({ name: 'Ana', phone: '123', email: 'no-es-correo' });
    expect(res.status).toBe(400);
    const campos = res.body.error.details.map((detalle) => detalle.field);
    expect(campos).toEqual(expect.arrayContaining(['phone', 'email']));
  });

  test('rechaza nombres de más de 100 caracteres', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const res = await request(app)
      .post('/api/clients')
      .set(bearer(token))
      .send({ name: 'x'.repeat(101), phone: '5512345678' });
    expect(res.status).toBe(400);
  });

  test('lista clientes con paginación y búsqueda por nombre, teléfono o correo', async () => {
    const { token } = await loginAs('MECHANIC');
    await createClient({ name: 'Ana Pérez', phone: '5511111111', email: 'ana@correo.com' });
    await createClient({ name: 'Luis Gómez', phone: '5522222222' });
    await createClient({ name: 'Marta Ruiz', phone: '5533333333' });

    const todos = await request(app).get('/api/clients?pageSize=2').set(bearer(token));
    expect(todos.body.data).toHaveLength(2);
    expect(todos.body.meta).toEqual({ page: 1, pageSize: 2, total: 3 });

    const porNombre = await request(app).get('/api/clients?search=luis').set(bearer(token));
    expect(porNombre.body.data.map((c) => c.name)).toEqual(['Luis Gómez']);

    const porTelefono = await request(app).get('/api/clients?search=5533').set(bearer(token));
    expect(porTelefono.body.data.map((c) => c.name)).toEqual(['Marta Ruiz']);

    const porCorreo = await request(app).get('/api/clients?search=ana@correo').set(bearer(token));
    expect(porCorreo.body.data.map((c) => c.name)).toEqual(['Ana Pérez']);
  });

  test('la búsqueda trata los comodines de SQL como texto literal', async () => {
    const { token } = await loginAs('MECHANIC');
    await createClient({ name: 'Ana Pérez' });
    const res = await request(app).get('/api/clients?search=%25').set(bearer(token));
    expect(res.body.data).toHaveLength(0);
  });

  test('por defecto solo lista clientes activos y el filtro active permite ver los demás', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    await createClient({ name: 'Activo' });
    await createClient({ name: 'Inactivo', active: false });

    const porDefecto = await request(app).get('/api/clients').set(bearer(token));
    expect(porDefecto.body.data.map((c) => c.name)).toEqual(['Activo']);

    const inactivos = await request(app).get('/api/clients?active=false').set(bearer(token));
    expect(inactivos.body.data.map((c) => c.name)).toEqual(['Inactivo']);

    const todos = await request(app).get('/api/clients?active=all').set(bearer(token));
    expect(todos.body.data).toHaveLength(2);
  });

  test('rechaza parámetros de paginación inválidos', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    expect((await request(app).get('/api/clients?pageSize=500').set(bearer(token))).status).toBe(400);
    expect((await request(app).get('/api/clients?page=0').set(bearer(token))).status).toBe(400);
  });

  test('el detalle de un cliente sin vehículos devuelve una lista vacía', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const client = await createClient();
    const res = await request(app).get(`/api/clients/${client.id}`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.vehicles).toEqual([]);
  });

  test('el detalle incluye los vehículos asociados activos e inactivos', async () => {
    const { token } = await loginAs('MECHANIC');
    const client = await createClient();
    await createVehicle({ clientId: client.id, licensePlate: 'AAA111' });
    await createVehicle({ clientId: client.id, licensePlate: 'BBB222', active: false });
    const res = await request(app).get(`/api/clients/${client.id}`).set(bearer(token));
    expect(res.body.data.vehicles.map((v) => v.licensePlate)).toEqual(['AAA111', 'BBB222']);
    expect(res.body.data.vehicleCount).toBe(1);
  });

  test('un cliente inexistente responde 404 y un identificador inválido responde 400', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    expect((await request(app).get('/api/clients/9999').set(bearer(token))).status).toBe(404);
    expect((await request(app).get('/api/clients/abc').set(bearer(token))).status).toBe(400);
  });

  test('el mecánico puede consultar pero recibe 403 al registrar', async () => {
    const { token } = await loginAs('MECHANIC');
    expect((await request(app).get('/api/clients').set(bearer(token))).status).toBe(200);
    const res = await request(app).post('/api/clients').set(bearer(token)).send({ name: 'Ana', phone: '5512345678' });
    expect(res.status).toBe(403);
  });

  test('sin token las rutas de clientes responden 401', async () => {
    expect((await request(app).get('/api/clients')).status).toBe(401);
    expect((await request(app).post('/api/clients').send({})).status).toBe(401);
  });
});
