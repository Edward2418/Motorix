import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app.js';
import { pool, resetTables, closePool, createUser, TEST_PASSWORD } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';

const login = (identifier, password = TEST_PASSWORD) =>
  request(app).post('/api/auth/login').send({ identifier, password });

describe('autenticación', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('inicia sesión con el nombre de usuario', async () => {
    const user = await createUser({ role: 'ADMIN', username: 'admin' });
    const res = await login(user.username);
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('ADMIN');
  });

  test('inicia sesión con el correo electrónico en el mismo campo', async () => {
    const user = await createUser({ role: 'RECEPTIONIST', email: 'recepcion@taller.test' });
    const res = await login(user.email);
    expect(res.status).toBe(200);
    expect(res.body.data.user.username).toBe(user.username);
  });

  test('ignora mayúsculas y espacios sobrantes en el usuario y el correo', async () => {
    await createUser({ role: 'MECHANIC', username: 'mecanico', email: 'mecanico@taller.test' });
    expect((await login('  MECANICO  ')).status).toBe(200);
    expect((await login(' Mecanico@Taller.TEST ')).status).toBe(200);
  });

  test('rechaza usuario inexistente, contraseña incorrecta y cuenta desactivada con el mismo mensaje', async () => {
    await createUser({ role: 'ADMIN', username: 'admin' });
    await createUser({ role: 'MECHANIC', username: 'baja', active: false });

    const inexistente = await login('nadie');
    const incorrecta = await login('admin', 'Incorrecta1');
    const desactivada = await login('baja');

    for (const res of [inexistente, incorrecta, desactivada]) {
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Credenciales incorrectas.');
    }
  });

  test('exige identificador y contraseña', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('una ruta protegida sin token responde 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('un token manipulado responde 401', async () => {
    const res = await request(app).get('/api/auth/me').set(bearer('token.invalido.firma'));
    expect(res.status).toBe(401);
  });

  test('un token vencido responde 401', async () => {
    const user = await createUser({ role: 'ADMIN' });
    const vencido = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: -60 });
    const res = await request(app).get('/api/auth/me').set(bearer(vencido));
    expect(res.status).toBe(401);
  });

  test('el token de un usuario desactivado deja de ser válido', async () => {
    const user = await createUser({ role: 'RECEPTIONIST' });
    const sesion = await login(user.username);
    await pool.query('UPDATE users SET active = 0 WHERE id = ?', [user.id]);
    const res = await request(app).get('/api/auth/me').set(bearer(sesion.body.data.token));
    expect(res.status).toBe(401);
  });

  test('cambia la contraseña con una nueva que cumple la política', async () => {
    const user = await createUser({ role: 'RECEPTIONIST' });
    const sesion = await login(user.username);
    const res = await request(app)
      .put('/api/auth/password')
      .set(bearer(sesion.body.data.token))
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'NuevaClave2026' });
    expect(res.status).toBe(204);
    expect((await login(user.username, TEST_PASSWORD)).status).toBe(401);
    expect((await login(user.username, 'NuevaClave2026')).status).toBe(200);
  });

  test('rechaza una contraseña nueva que incumple la política e indica qué falta', async () => {
    const user = await createUser({ role: 'RECEPTIONIST' });
    const sesion = await login(user.username);
    const res = await request(app)
      .put('/api/auth/password')
      .set(bearer(sesion.body.data.token))
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'corta' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.length).toBeGreaterThan(0);
    expect(res.body.error.details[0].field).toBe('newPassword');
  });

  test('rechaza el cambio de contraseña si la contraseña actual es incorrecta', async () => {
    const user = await createUser({ role: 'RECEPTIONIST' });
    const sesion = await login(user.username);
    const res = await request(app)
      .put('/api/auth/password')
      .set(bearer(sesion.body.data.token))
      .send({ currentPassword: 'Equivocada1', newPassword: 'NuevaClave2026' });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('currentPassword');
  });
});
