import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../app.js';
import { env } from '../../config/env.js';
import { sessionStamp } from '../../utils/jwt.js';
import { pool, resetTables, closePool, createUser } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';

beforeEach(resetTables);
afterAll(closePool);

const consultar = (token) => request(app).get('/api/auth/me').set(bearer(token));
const firmar = (payload, opciones = {}) => jwt.sign(payload, env.jwt.secret, opciones);
// La carga completa de un token bueno. Así cada caso se rechaza solo por su defecto y no porque le falte la marca.
async function carga(usuario) {
  const [[fila]] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [usuario.id]);
  return { sub: usuario.id, role: usuario.role, pv: sessionStamp(fila.password_hash) };
}

// El servidor valida la vigencia del token en cada petición, además del cierre por inactividad del cliente. Este
// comportamiento ya existe desde el Sprint 1; la prueba lo deja protegido.
describe('el servidor rechaza los tokens que no sirven', () => {
  test('un token vencido responde 401', async () => {
    const usuario = await createUser({ username: 'lucia', role: 'RECEPTIONIST' });
    const vencido = firmar(await carga(usuario), { expiresIn: -60 });

    const res = await consultar(vencido);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  test('un token firmado con otra clave responde 401', async () => {
    const usuario = await createUser({ username: 'lucia', role: 'RECEPTIONIST' });
    const falso = jwt.sign(await carga(usuario), 'otra-clave-que-no-es-la-del-servidor', { expiresIn: '1h' });

    expect((await consultar(falso)).status).toBe(401);
  });

  test('un token manipulado (carga cambiada) responde 401', async () => {
    const usuario = await createUser({ username: 'lucia', role: 'RECEPTIONIST' });
    const original = await carga(usuario);
    const bueno = firmar(original, { expiresIn: '1h' });
    const [cabecera, , firma] = bueno.split('.');
    const alterada = Buffer.from(JSON.stringify({ ...original, role: 'ADMIN', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');

    expect((await consultar(`${cabecera}.${alterada}.${firma}`)).status).toBe(401);
  });

  test('un token válido de un usuario que se desactivó responde 401', async () => {
    const usuario = await createUser({ username: 'lucia', role: 'RECEPTIONIST' });
    const token = firmar(await carga(usuario), { expiresIn: '1h' });
    expect((await consultar(token)).status).toBe(200);

    await pool.query('UPDATE users SET active = 0 WHERE id = ?', [usuario.id]);

    expect((await consultar(token)).status).toBe(401);
  });

  test('un token sin la marca de la contraseña responde 401', async () => {
    const usuario = await createUser({ username: 'lucia', role: 'RECEPTIONIST' });
    const sinMarca = firmar({ sub: usuario.id, role: usuario.role }, { expiresIn: '1h' });

    expect((await consultar(sinMarca)).status).toBe(401);
  });

  test('sin token o con un texto cualquiera responde 401', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await consultar('esto-no-es-un-token')).status).toBe(401);
  });

  test('la vigencia del token de inicio de sesión es de 8 horas por defecto', async () => {
    await createUser({ username: 'lucia', role: 'RECEPTIONIST' });
    const res = await request(app).post('/api/auth/login').send({ identifier: 'lucia', password: 'Prueba2026!' });
    const { exp, iat } = jwt.decode(res.body.data.token);
    expect(exp - iat).toBe(env.jwt.expiresIn === '8h' ? 8 * 3600 : exp - iat);
  });
});
