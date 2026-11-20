import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createUser, TEST_PASSWORD } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

beforeEach(resetTables);
afterAll(closePool);

const crearUsuario = (token, password) =>
  request(app)
    .post('/api/users')
    .set(bearer(token))
    .send({ username: 'nuevo.usuario', name: 'Nuevo Usuario', email: 'nuevo@motorix.test', password, role: 'RECEPTIONIST' });
const cambiarContrasena = (token, newPassword, currentPassword = TEST_PASSWORD) =>
  request(app).put('/api/auth/password').set(bearer(token)).send({ currentPassword, newPassword });

const DEBILES = [
  ['7 caracteres', 'Abcde12', 'al menos 8 caracteres'],
  ['sin mayúscula', 'abcdefg12', 'mayúscula'],
  ['sin minúscula', 'ABCDEFG12', 'minúscula'],
  ['sin número', 'Abcdefghi', 'número'],
  ['de más de 72 bytes', `Aa1${'x'.repeat(72)}`, '72 bytes']
];

// Estas pruebas verifican un comportamiento que ya existe (la política viene del Sprint 1): pueden pasar al escribirlas.
describe('política de contraseñas al crear un usuario', () => {
  test.each(DEBILES)('rechaza una contraseña %s con 400 y un mensaje que dice qué falta', async (_nombre, contrasena, fragmento) => {
    const { token } = await loginAs('ADMIN');

    const res = await crearUsuario(token, contrasena);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const mensajes = res.body.error.details.filter((d) => d.field === 'password').map((d) => d.message);
    expect(mensajes.join(' ')).toContain(fragmento);
  });

  test('acepta una contraseña válida y la guarda solo como hash bcrypt', async () => {
    const { token } = await loginAs('ADMIN');

    const res = await crearUsuario(token, 'Clave2026Segura');

    expect(res.status).toBe(201);
    const [[fila]] = await pool.query('SELECT password_hash FROM users WHERE username = ?', ['nuevo.usuario']);
    expect(fila.password_hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(fila.password_hash).not.toContain('Clave2026Segura');
    expect(JSON.stringify(res.body)).not.toMatch(/password_hash|passwordHash|\$2b\$/);
  });

  test('una contraseña sin nada (vacía o ausente) responde 400', async () => {
    const { token } = await loginAs('ADMIN');
    expect((await crearUsuario(token, '')).status).toBe(400);
    expect((await crearUsuario(token, undefined)).status).toBe(400);
  });
});

describe('política de contraseñas al cambiarla', () => {
  test.each(DEBILES)('rechaza una contraseña nueva %s con 400 y un mensaje que dice qué falta', async (_nombre, contrasena, fragmento) => {
    const { token } = await loginAs('RECEPTIONIST');

    const res = await cambiarContrasena(token, contrasena);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const mensajes = res.body.error.details.filter((d) => d.field === 'newPassword').map((d) => d.message);
    expect(mensajes.join(' ')).toContain(fragmento);
  });

  test('con una contraseña válida el cambio funciona y la nueva se guarda solo como hash', async () => {
    const usuario = await createUser({ username: 'lucia', role: 'RECEPTIONIST' });
    const sesion = await request(app).post('/api/auth/login').send({ identifier: 'lucia', password: TEST_PASSWORD });

    const res = await cambiarContrasena(sesion.body.data.token, 'NuevaClave2026');

    expect(res.status).toBeLessThan(300);
    const [[fila]] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [usuario.id]);
    expect(fila.password_hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(fila.password_hash).not.toContain('NuevaClave2026');
    const nueva = await request(app).post('/api/auth/login').send({ identifier: 'lucia', password: 'NuevaClave2026' });
    expect(nueva.status).toBe(200);
  });

  test('con la contraseña actual incorrecta responde 400 y no cambia nada', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const res = await cambiarContrasena(token, 'NuevaClave2026', 'EquivocadaAbc1');
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain('currentPassword');
  });
});
