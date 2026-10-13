import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createUser, TEST_PASSWORD } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';

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

describe('contrato de /api/auth', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('POST /auth/login devuelve token, vigencia y usuario sin hash de contraseña', async () => {
    const user = await createUser({ role: 'ADMIN' });
    const res = await request(app).post('/api/auth/login').send({ identifier: user.username, password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      token: expect.any(String),
      expiresIn: expect.any(Number),
      user: userShape
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  test('GET /auth/me devuelve el usuario de la sesión', async () => {
    const user = await createUser({ role: 'MECHANIC' });
    const login = await request(app).post('/api/auth/login').send({ identifier: user.email, password: TEST_PASSWORD });
    const res = await request(app).get('/api/auth/me').set(bearer(login.body.data.token));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(userShape);
  });

  test('PUT /auth/password responde 204 sin cuerpo', async () => {
    const user = await createUser({ role: 'RECEPTIONIST' });
    const login = await request(app).post('/api/auth/login').send({ identifier: user.username, password: TEST_PASSWORD });
    const res = await request(app)
      .put('/api/auth/password')
      .set(bearer(login.body.data.token))
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'NuevaClave2026' });
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
  });

  test('los errores usan el formato { error: { code, message } }', async () => {
    const res = await request(app).post('/api/auth/login').send({ identifier: 'nadie', password: 'x' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'UNAUTHENTICATED', message: expect.any(String) } });
  });
});
