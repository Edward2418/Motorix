import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createServiceType } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';

beforeEach(resetTables);
afterAll(closePool);

const crear = (token, cuerpo) => request(app).post('/api/service-types').set(bearer(token)).send(cuerpo);
const editar = (token, id, cuerpo) => request(app).put(`/api/service-types/${id}`).set(bearer(token)).send(cuerpo);
const estado = (token, id, active) => request(app).patch(`/api/service-types/${id}/status`).set(bearer(token)).send({ active });
const listar = (token, consulta = '') => request(app).get(`/api/service-types${consulta}`).set(bearer(token));

describe('alta y edición', () => {
  test('POST crea un tipo y lo devuelve con 201', async () => {
    const { token } = await loginAs('ADMIN');

    const res = await crear(token, { name: 'Cambio de aceite', intervalDays: 180, intervalKm: 5000 });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ id: expect.any(Number), name: 'Cambio de aceite', intervalDays: 180, intervalKm: 5000, active: true });
  });

  test('un tipo con un solo intervalo guarda el otro como nulo', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await crear(token, { name: 'Alineación', intervalKm: 10000 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ intervalDays: null, intervalKm: 10000 });
  });

  test('PUT edita nombre e intervalos', async () => {
    const { token } = await loginAs('ADMIN');
    const tipo = await createServiceType();

    const res = await editar(token, tipo.id, { name: 'Cambio de aceite sintético', intervalDays: 365, intervalKm: null });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: tipo.id, name: 'Cambio de aceite sintético', intervalDays: 365, intervalKm: null });
  });

  test('un nombre repetido, también con otras mayúsculas, responde 409 SERVICE_TYPE_DUPLICATE', async () => {
    const { token } = await loginAs('ADMIN');
    await createServiceType({ name: 'Cambio de aceite' });

    const res = await crear(token, { name: 'CAMBIO DE ACEITE', intervalDays: 30 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SERVICE_TYPE_DUPLICATE');
  });

  test('editar un tipo con el nombre de otro responde 409, pero conservar el propio nombre es válido', async () => {
    const { token } = await loginAs('ADMIN');
    await createServiceType({ name: 'Frenos' });
    const aceite = await createServiceType({ name: 'Aceite' });

    expect((await editar(token, aceite.id, { name: 'frenos', intervalDays: 30 })).status).toBe(409);
    expect((await editar(token, aceite.id, { name: 'Aceite', intervalDays: 90 })).status).toBe(200);
  });

  test('un tipo sin intervalos responde 400 VALIDATION_ERROR con el campo indicado', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await crear(token, { name: 'Sin intervalos' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toContain('intervalDays');
  });

  test.each([
    [{ name: '', intervalDays: 30 }, 'name'],
    [{ name: 'X', intervalDays: 0 }, 'intervalDays'],
    [{ name: 'X', intervalDays: 3651 }, 'intervalDays'],
    [{ name: 'X', intervalKm: 500001 }, 'intervalKm']
  ])('datos inválidos %j responden 400 con el campo %s', async (cuerpo, campo) => {
    const { token } = await loginAs('ADMIN');
    const res = await crear(token, cuerpo);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain(campo);
  });

  test('editar un tipo que no existe responde 404', async () => {
    const { token } = await loginAs('ADMIN');
    expect((await editar(token, 9999, { name: 'X', intervalDays: 30 })).status).toBe(404);
  });
});

describe('activar y desactivar', () => {
  test('PATCH desactiva y reactiva; nunca se borra', async () => {
    const { token } = await loginAs('ADMIN');
    const tipo = await createServiceType();

    const desactivado = await estado(token, tipo.id, false);
    expect(desactivado.status).toBe(200);
    expect(desactivado.body.data.active).toBe(false);

    const reactivado = await estado(token, tipo.id, true);
    expect(reactivado.body.data.active).toBe(true);
    expect((await pool.query('SELECT COUNT(*) AS total FROM service_types'))[0][0].total).toBe(1);
  });

  test('un cuerpo sin active responde 400 y un tipo inexistente 404', async () => {
    const { token } = await loginAs('ADMIN');
    const tipo = await createServiceType();
    expect((await request(app).patch(`/api/service-types/${tipo.id}/status`).set(bearer(token)).send({})).status).toBe(400);
    expect((await estado(token, 9999, false)).status).toBe(404);
  });

  test('no existe DELETE: responde 404 y el tipo se conserva', async () => {
    const { token } = await loginAs('ADMIN');
    const tipo = await createServiceType();
    const res = await request(app).delete(`/api/service-types/${tipo.id}`).set(bearer(token));
    expect(res.status).toBe(404);
    expect((await pool.query('SELECT COUNT(*) AS total FROM service_types'))[0][0].total).toBe(1);
  });

  test('un tipo desactivado conserva su enlace en las líneas que ya lo usan', async () => {
    const escenario = await escenarioOrden('DIAGNOSTICO');
    const tipo = await createServiceType();
    await pool.query('INSERT INTO order_services (order_id, description, cost, service_type_id) VALUES (?, ?, ?, ?)', [
      escenario.orden.id,
      'Cambio de aceite',
      500,
      tipo.id
    ]);

    await estado(escenario.tokens.admin, tipo.id, false);

    const [[linea]] = await pool.query('SELECT service_type_id FROM order_services WHERE order_id = ?', [escenario.orden.id]);
    expect(linea.service_type_id).toBe(tipo.id);
  });
});

describe('consulta', () => {
  test('lista todos los tipos por nombre', async () => {
    const { token } = await loginAs('ADMIN');
    await createServiceType({ name: 'Frenos' });
    await createServiceType({ name: 'Aceite' });
    await createServiceType({ name: 'Batería', active: false });

    const res = await listar(token);

    expect(res.status).toBe(200);
    expect(res.body.data.map((t) => t.name)).toEqual(['Aceite', 'Batería', 'Frenos']);
  });

  test('active=true excluye los desactivados y active=false solo devuelve esos', async () => {
    const { token } = await loginAs('ADMIN');
    await createServiceType({ name: 'Frenos' });
    await createServiceType({ name: 'Batería', active: false });

    expect((await listar(token, '?active=true')).body.data.map((t) => t.name)).toEqual(['Frenos']);
    expect((await listar(token, '?active=false')).body.data.map((t) => t.name)).toEqual(['Batería']);
  });

  test('un valor de active que no es true ni false responde 400', async () => {
    const { token } = await loginAs('ADMIN');
    expect((await listar(token, '?active=quizas')).status).toBe(400);
  });
});

describe('permisos', () => {
  test.each(['ADMIN', 'RECEPTIONIST', 'MECHANIC'])('el rol %s puede leer el catálogo', async (rol) => {
    const { token } = await loginAs(rol);
    expect((await listar(token)).status).toBe(200);
  });

  test.each(['RECEPTIONIST', 'MECHANIC'])('el rol %s recibe 403 al crear, editar y cambiar el estado', async (rol) => {
    const { token } = await loginAs(rol);
    const tipo = await createServiceType();

    for (const res of [
      await crear(token, { name: 'Nuevo', intervalDays: 30 }),
      await editar(token, tipo.id, { name: 'Otro', intervalDays: 30 }),
      await estado(token, tipo.id, false)
    ]) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
    expect((await pool.query('SELECT name, active FROM service_types'))[0][0]).toMatchObject({ name: tipo.name, active: 1 });
  });

  test('sin token responde 401', async () => {
    expect((await request(app).get('/api/service-types')).status).toBe(401);
  });
});
