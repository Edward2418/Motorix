import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createClient, createVehicle } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

const put = (token, id, body) => request(app).put(`/api/clients/${id}`).set(bearer(token)).send(body);
const patchStatus = (token, id, body) => request(app).patch(`/api/clients/${id}/status`).set(bearer(token)).send(body);

describe('clientes: editar y desactivar', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('edita los datos de un cliente y los cambios se ven al consultarlo', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const client = await createClient({ name: 'Ana Pérez', phone: '5511111111' });

    const res = await put(token, client.id, { name: '  Ana Pérez Gómez ', phone: '5599999999', email: 'ANA@correo.com' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'Ana Pérez Gómez', phone: '5599999999', email: 'ana@correo.com' });

    const detalle = await request(app).get(`/api/clients/${client.id}`).set(bearer(token));
    expect(detalle.body.data.name).toBe('Ana Pérez Gómez');
  });

  test('permite quitar el correo al editar', async () => {
    const { token } = await loginAs('ADMIN');
    const client = await createClient({ email: 'ana@correo.com' });
    const res = await put(token, client.id, { name: 'Ana', phone: '5511111111', email: '' });
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBeNull();
  });

  test('rechaza datos inválidos al editar y no modifica el cliente', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const client = await createClient({ name: 'Ana Pérez' });
    const res = await put(token, client.id, { name: '', phone: 'abc', email: 'malo' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['name', 'phone', 'email']));

    const detalle = await request(app).get(`/api/clients/${client.id}`).set(bearer(token));
    expect(detalle.body.data.name).toBe('Ana Pérez');
  });

  test('editar un cliente inexistente responde 404', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    expect((await put(token, 9999, { name: 'Ana', phone: '5511111111' })).status).toBe(404);
  });

  test('el mecánico recibe 403 al editar o cambiar el estado', async () => {
    const { token } = await loginAs('MECHANIC');
    const client = await createClient();
    expect((await put(token, client.id, { name: 'Ana', phone: '5511111111' })).status).toBe(403);
    expect((await patchStatus(token, client.id, { active: false })).status).toBe(403);
  });

  test('desactiva un cliente sin vehículos activos y lo reactiva', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const client = await createClient();

    const baja = await patchStatus(token, client.id, { active: false });
    expect(baja.status).toBe(200);
    expect(baja.body.data.active).toBe(false);

    const alta = await patchStatus(token, client.id, { active: true });
    expect(alta.status).toBe(200);
    expect(alta.body.data.active).toBe(true);
  });

  test('rechaza desactivar un cliente con vehículos activos hasta que estén desactivados', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const client = await createClient();
    const vehicle = await createVehicle({ clientId: client.id });

    const rechazo = await patchStatus(token, client.id, { active: false });
    expect(rechazo.status).toBe(409);
    expect(rechazo.body.error.message).toMatch(/vehículos activos/i);
    const [filas] = await pool.query('SELECT active FROM clients WHERE id = ?', [client.id]);
    expect(filas[0].active).toBe(1);

    await request(app).patch(`/api/vehicles/${vehicle.id}/status`).set(bearer(token)).send({ active: false });
    const exito = await patchStatus(token, client.id, { active: false });
    expect(exito.status).toBe(200);
  });

  test('un cliente con vehículos solo desactivados sí se puede desactivar y conserva sus vehículos', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const client = await createClient();
    await createVehicle({ clientId: client.id, active: false });
    expect((await patchStatus(token, client.id, { active: false })).status).toBe(200);
    const detalle = await request(app).get(`/api/clients/${client.id}`).set(bearer(token));
    expect(detalle.body.data.vehicles).toHaveLength(1);
  });

  test('un cliente desactivado no admite vehículos nuevos hasta reactivarlo', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const client = await createClient();
    await patchStatus(token, client.id, { active: false });
    const datos = { clientId: client.id, brand: 'Nissan', model: 'Versa', year: 2020, licensePlate: 'ABC1234' };

    const rechazo = await request(app).post('/api/vehicles').set(bearer(token)).send(datos);
    expect(rechazo.status).toBe(409);

    await patchStatus(token, client.id, { active: true });
    const exito = await request(app).post('/api/vehicles').set(bearer(token)).send(datos);
    expect(exito.status).toBe(201);
  });

  test('el cambio de estado exige un valor booleano y un cliente existente', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const client = await createClient();
    expect((await patchStatus(token, client.id, {})).status).toBe(400);
    expect((await patchStatus(token, client.id, { active: 'no' })).status).toBe(400);
    expect((await patchStatus(token, 9999, { active: false })).status).toBe(404);
  });
});
