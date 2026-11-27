import request from 'supertest';
import app, { createApp } from '../../app.js';
import { pool, resetTables, closePool, createUser, TEST_PASSWORD } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';

beforeEach(resetTables);
afterAll(closePool);

const entrar = (identifier, password = TEST_PASSWORD, ip, objetivo = app) => {
  const peticion = request(objetivo).post('/api/auth/login');
  if (ip) peticion.set('X-Forwarded-For', ip);
  return peticion.send({ identifier, password });
};
const estados = (respuestas) => respuestas.reduce((m, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + 1 }), {});

// Aplicación detrás de un proxy de confianza (como en el hosting): el origen real llega en X-Forwarded-For.
const trasProxy = createApp({ trustProxy: 1 });

describe('intentos simultáneos', () => {
  test('de 30 contraseñas malas enviadas a la vez solo se evalúan 5 y la correcta, enviada al final, no entra', async () => {
    await createUser({ username: 'victima', role: 'ADMIN' });
    const malas = Array.from({ length: 30 }, (_, i) => `Incorrecta${i}x`);

    const respuestas = await Promise.all([...malas, TEST_PASSWORD].map((p) => entrar('victima', p)));

    expect(estados(respuestas)).toEqual({ 401: 5, 429: 26 });
    expect(respuestas.at(-1).status).toBe(429);
  });
});

describe('límite por origen', () => {
  test('quien bloquea una cuenta desde otro origen no impide entrar a su dueño', async () => {
    await createUser({ username: 'dueno', role: 'ADMIN' });
    for (let i = 0; i < 6; i += 1) await entrar('dueno', 'Incorrecta1', '203.0.113.9', trasProxy);

    expect((await entrar('dueno', TEST_PASSWORD, '203.0.113.9', trasProxy)).status).toBe(429);
    expect((await entrar('dueno', TEST_PASSWORD, '198.51.100.4', trasProxy)).status).toBe(200);
  });

  test('la cuenta se bloquea para todos tras 20 fallos repartidos entre varios orígenes', async () => {
    await createUser({ username: 'dueno', role: 'ADMIN' });
    for (let origen = 1; origen <= 4; origen += 1) {
      for (let i = 0; i < 5; i += 1) await entrar('dueno', 'Incorrecta1', `203.0.113.${origen}`, trasProxy);
    }

    expect((await entrar('dueno', TEST_PASSWORD, '198.51.100.4', trasProxy)).status).toBe(429);
  });

  test('un origen que prueba muchas cuentas queda bloqueado tras 20 fallos, y los demás orígenes siguen', async () => {
    await createUser({ username: 'otra', role: 'RECEPTIONIST' });
    for (let i = 0; i < 20; i += 1) {
      expect((await entrar(`cuenta${i}`, 'Incorrecta1', '203.0.113.7', trasProxy)).status).toBe(401);
    }

    expect((await entrar('otra', TEST_PASSWORD, '203.0.113.7', trasProxy)).status).toBe(429);
    expect((await entrar('otra', TEST_PASSWORD, '198.51.100.4', trasProxy)).status).toBe(200);
  });

  test('los inicios de sesión correctos no acumulan fallos para su origen', async () => {
    await createUser({ username: 'diaria', role: 'RECEPTIONIST' });
    for (let i = 0; i < 25; i += 1) {
      expect((await entrar('diaria', TEST_PASSWORD, '203.0.113.8', trasProxy)).status).toBe(200);
    }
  });

  test('sin proxy de confianza se ignora X-Forwarded-For, así no se puede fingir otro origen', async () => {
    await createUser({ username: 'dueno', role: 'ADMIN' });
    for (let i = 0; i < 5; i += 1) await entrar('dueno', 'Incorrecta1', `203.0.113.${i}`);

    expect((await entrar('dueno', TEST_PASSWORD, '198.51.100.4')).status).toBe(429);
  });
});

describe('identificador demasiado largo', () => {
  test('responde 400 con el campo y no guarda nada', async () => {
    const res = await entrar('x'.repeat(5000), 'Incorrecta1');

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('identifier');
    const [[fila]] = await pool.query('SELECT COUNT(*) AS total FROM login_attempts');
    expect(Number(fila.total)).toBe(0);
  });

  test('el máximo permitido (254) se procesa con normalidad', async () => {
    expect((await entrar('x'.repeat(254), 'Incorrecta1')).status).toBe(401);
  });
});

describe('sesiones al cambiar la contraseña', () => {
  const cambiar = (token) =>
    request(app).put('/api/auth/password').set(bearer(token)).send({ currentPassword: TEST_PASSWORD, newPassword: 'Cambiada2026x' });

  test('los tokens anteriores dejan de servir y la respuesta entrega uno nuevo para seguir', async () => {
    await createUser({ username: 'persona', role: 'ADMIN' });
    const este = (await entrar('persona')).body.data.token;
    const otroDispositivo = (await entrar('persona')).body.data.token;

    const res = await cambiar(este);

    expect(res.status).toBe(204);
    const nuevo = res.headers['x-auth-token'];
    expect(nuevo).toEqual(expect.any(String));
    expect((await request(app).get('/api/auth/me').set(bearer(este))).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(bearer(otroDispositivo))).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(bearer(nuevo))).status).toBe(200);
  });

  test('el navegador puede leer la cabecera del token nuevo', async () => {
    await createUser({ username: 'persona', role: 'ADMIN' });
    const token = (await entrar('persona')).body.data.token;

    const res = await cambiar(token).set('Origin', 'http://localhost:5000');

    expect(res.headers['access-control-expose-headers']).toMatch(/X-Auth-Token/i);
  });
});
