import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createUser } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

const valid = (overrides = {}) => ({
  username: 'nuevo.usuario',
  name: 'Nuevo Usuario',
  email: 'nuevo@taller.test',
  password: 'Clave2026Nueva',
  role: 'RECEPTIONIST',
  ...overrides
});

const post = (token, body) => request(app).post('/api/users').set(bearer(token)).send(body);
const login = (identifier, password) => request(app).post('/api/auth/login').send({ identifier, password });

describe('gestión de usuarios', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('el administrador registra un usuario y este puede iniciar sesión', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await post(token, valid());
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('RECEPTIONIST');

    const sesion = await login('nuevo.usuario', 'Clave2026Nueva');
    expect(sesion.status).toBe(200);
    expect(sesion.body.data.user.role).toBe('RECEPTIONIST');
    expect((await login('nuevo@taller.test', 'Clave2026Nueva')).status).toBe(200);
  });

  test('guarda la contraseña solo como hash bcrypt', async () => {
    const { token } = await loginAs('ADMIN');
    await post(token, valid());
    const { pool } = await import('../helpers/db.js');
    const [rows] = await pool.query('SELECT password_hash FROM users WHERE username = ?', ['nuevo.usuario']);
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/);
    expect(rows[0].password_hash).not.toContain('Clave2026Nueva');
  });

  test('rechaza un nombre de usuario o un correo repetidos', async () => {
    const { token } = await loginAs('ADMIN');
    await createUser({ username: 'existente', email: 'existente@taller.test', role: 'MECHANIC' });

    const porUsuario = await post(token, valid({ username: 'EXISTENTE' }));
    expect(porUsuario.status).toBe(409);
    expect(porUsuario.body.error.message).toMatch(/usuario/i);

    const porCorreo = await post(token, valid({ email: 'Existente@Taller.test' }));
    expect(porCorreo.status).toBe(409);
    expect(porCorreo.body.error.message).toMatch(/correo/i);
  });

  test('rechaza una contraseña que incumple la política y un rol inválido', async () => {
    const { token } = await loginAs('ADMIN');
    const contrasena = await post(token, valid({ password: 'corta' }));
    expect(contrasena.status).toBe(400);
    expect(contrasena.body.error.details.map((d) => d.field)).toContain('password');

    const rol = await post(token, valid({ role: 'SUPERUSUARIO' }));
    expect(rol.status).toBe(400);
    expect(rol.body.error.details.map((d) => d.field)).toContain('role');
  });

  test('valida el formato del nombre de usuario y del correo', async () => {
    const { token } = await loginAs('ADMIN');
    expect((await post(token, valid({ username: 'ab' }))).status).toBe(400);
    expect((await post(token, valid({ username: 'con espacios' }))).status).toBe(400);
    expect((await post(token, valid({ email: 'sin-arroba' }))).status).toBe(400);
    expect((await post(token, valid({ name: '' }))).status).toBe(400);
  });

  test('lista usuarios con búsqueda y filtro de estado', async () => {
    const { token } = await loginAs('ADMIN', { username: 'admin' });
    await createUser({ username: 'lucia', role: 'RECEPTIONIST', name: 'Lucía Ortiz' });
    await createUser({ username: 'baja', role: 'MECHANIC', active: false });

    const activos = await request(app).get('/api/users').set(bearer(token));
    expect(activos.body.data.map((u) => u.username).sort()).toEqual(['admin', 'lucia']);

    const busqueda = await request(app).get('/api/users?search=ort').set(bearer(token));
    expect(busqueda.body.data.map((u) => u.username)).toEqual(['lucia']);

    const todos = await request(app).get('/api/users?active=all').set(bearer(token));
    expect(todos.body.data).toHaveLength(3);
  });

  test('edita nombre, correo y rol de un usuario', async () => {
    const { token } = await loginAs('ADMIN');
    const otro = await createUser({ role: 'MECHANIC' });
    const res = await request(app)
      .put(`/api/users/${otro.id}`)
      .set(bearer(token))
      .send({ name: 'Nombre Nuevo', email: 'NUEVO@taller.test', role: 'RECEPTIONIST' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'Nombre Nuevo', email: 'nuevo@taller.test', role: 'RECEPTIONIST' });
  });

  test('no permite editar el correo a uno que ya usa otro usuario', async () => {
    const { token } = await loginAs('ADMIN');
    const otro = await createUser({ username: 'otro', role: 'MECHANIC' });
    await createUser({ username: 'ocupado', email: 'ocupado@taller.test', role: 'MECHANIC' });
    const res = await request(app)
      .put(`/api/users/${otro.id}`)
      .set(bearer(token))
      .send({ name: 'Otro', email: 'ocupado@taller.test', role: 'MECHANIC' });
    expect(res.status).toBe(409);
  });

  test('desactiva un usuario, que deja de poder iniciar sesión, y lo reactiva', async () => {
    const { token } = await loginAs('ADMIN');
    const otro = await createUser({ username: 'otro', role: 'RECEPTIONIST' });

    const baja = await request(app).patch(`/api/users/${otro.id}/status`).set(bearer(token)).send({ active: false });
    expect(baja.status).toBe(200);
    expect(baja.body.data.active).toBe(false);
    expect((await login('otro', otro.password)).status).toBe(401);

    const alta = await request(app).patch(`/api/users/${otro.id}/status`).set(bearer(token)).send({ active: true });
    expect(alta.body.data.active).toBe(true);
    expect((await login('otro', otro.password)).status).toBe(200);
  });

  test('un administrador no puede desactivarse a sí mismo', async () => {
    const { token, user } = await loginAs('ADMIN');
    await createUser({ username: 'admin2', role: 'ADMIN' });
    const res = await request(app).patch(`/api/users/${user.id}/status`).set(bearer(token)).send({ active: false });
    expect(res.status).toBe(409);
  });

  test('no se puede desactivar ni quitar el rol al último administrador activo', async () => {
    const { token } = await loginAs('ADMIN', { username: 'admin' });
    const inactivo = await createUser({ username: 'admin2', role: 'ADMIN', active: false });

    // El único administrador activo es quien inició sesión: cambiar su propio rol deja al sistema sin ADMIN.
    const yo = (await request(app).get('/api/auth/me').set(bearer(token))).body.data;
    const rol = await request(app)
      .put(`/api/users/${yo.id}`)
      .set(bearer(token))
      .send({ name: yo.name, email: yo.email, role: 'RECEPTIONIST' });
    expect(rol.status).toBe(409);

    // Con otro administrador activo sí se puede quitar el rol a uno de ellos.
    await request(app).patch(`/api/users/${inactivo.id}/status`).set(bearer(token)).send({ active: true });
    const permitido = await request(app)
      .put(`/api/users/${inactivo.id}`)
      .set(bearer(token))
      .send({ name: 'Admin dos', email: inactivo.email, role: 'MECHANIC' });
    expect(permitido.status).toBe(200);
  });

  test('RECEPTIONIST y MECHANIC reciben 403 en todas las rutas de usuarios', async () => {
    const objetivo = await createUser({ username: 'objetivo', role: 'MECHANIC' });
    for (const role of ['RECEPTIONIST', 'MECHANIC']) {
      const { token } = await loginAs(role);
      expect((await request(app).get('/api/users').set(bearer(token))).status).toBe(403);
      expect((await request(app).get(`/api/users/${objetivo.id}`).set(bearer(token))).status).toBe(403);
      expect((await post(token, valid())).status).toBe(403);
      expect(
        (await request(app).put(`/api/users/${objetivo.id}`).set(bearer(token)).send({ name: 'x', email: 'x@x.co', role: 'ADMIN' }))
          .status
      ).toBe(403);
      expect(
        (await request(app).patch(`/api/users/${objetivo.id}/status`).set(bearer(token)).send({ active: false })).status
      ).toBe(403);
    }
  });

  test('no existe registro público: crear usuarios exige sesión de administrador', async () => {
    expect((await request(app).post('/api/users').send(valid())).status).toBe(401);
    expect((await request(app).post('/api/auth/register').send(valid())).status).toBe(404);
    expect((await request(app).post('/api/auth/forgot-password').send({ email: 'a@b.co' })).status).toBe(404);
  });

  test('un usuario inexistente responde 404 y un identificador inválido responde 400', async () => {
    const { token } = await loginAs('ADMIN');
    expect((await request(app).get('/api/users/9999').set(bearer(token))).status).toBe(404);
    expect((await request(app).get('/api/users/abc').set(bearer(token))).status).toBe(400);
  });
});
