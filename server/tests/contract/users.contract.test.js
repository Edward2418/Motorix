import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createUser } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

const userShape = {
  id: expect.any(Number),
  username: expect.any(String),
  name: expect.any(String),
  email: expect.any(String),
  role: expect.stringMatching(/^(ADMIN|RECEPTIONIST|MECHANIC)$/),
  active: expect.any(Boolean),
  createdAt: expect.any(String),
  updatedAt: expect.any(String)
};

const newUser = {
  username: 'nuevo.usuario',
  name: 'Nuevo Usuario',
  email: 'nuevo@taller.test',
  password: 'Clave2026Nueva',
  role: 'MECHANIC'
};

describe('contrato de /api/users', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('GET /users devuelve { data: [...], meta } sin datos de contraseña', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await request(app).get('/api/users').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
    expect(res.body.data[0]).toEqual(userShape);
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  test('POST /users responde 201 con el usuario creado', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await request(app).post('/api/users').set(bearer(token)).send(newUser);
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ ...userShape, username: 'nuevo.usuario', role: 'MECHANIC', active: true });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  test('GET /users/{id} devuelve el usuario', async () => {
    const { token } = await loginAs('ADMIN');
    const other = await createUser({ role: 'MECHANIC' });
    const res = await request(app).get(`/api/users/${other.id}`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(userShape);
  });

  test('PUT /users/{id} devuelve el usuario actualizado', async () => {
    const { token } = await loginAs('ADMIN');
    const other = await createUser({ role: 'MECHANIC' });
    const res = await request(app)
      .put(`/api/users/${other.id}`)
      .set(bearer(token))
      .send({ name: 'Otro Nombre', email: 'otro@taller.test', role: 'RECEPTIONIST' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ ...userShape, name: 'Otro Nombre', role: 'RECEPTIONIST' });
  });

  test('PATCH /users/{id}/status devuelve el usuario con su nuevo estado', async () => {
    const { token } = await loginAs('ADMIN');
    const other = await createUser({ role: 'MECHANIC' });
    const res = await request(app).patch(`/api/users/${other.id}/status`).set(bearer(token)).send({ active: false });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ ...userShape, active: false });
  });
});
