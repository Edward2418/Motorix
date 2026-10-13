import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createUser, TEST_PASSWORD } from '../helpers/db.js';

const login = (identifier, password = TEST_PASSWORD) =>
  request(app).post('/api/auth/login').send({ identifier, password });

async function fallar(identifier, veces) {
  const respuestas = [];
  for (let i = 0; i < veces; i++) {
    respuestas.push(await login(identifier, 'Incorrecta1'));
  }
  return respuestas;
}

describe('bloqueo por intentos de inicio de sesión fallidos', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('cuatro fallos consecutivos no bloquean la cuenta', async () => {
    const user = await createUser({ username: 'lucia', role: 'RECEPTIONIST' });
    const respuestas = await fallar(user.username, 4);
    respuestas.forEach((res) => expect(res.status).toBe(401));
    expect((await login(user.username)).status).toBe(200);
  });

  test('el quinto fallo consecutivo bloquea y el siguiente intento responde 429 con el tiempo restante', async () => {
    const user = await createUser({ username: 'lucia', role: 'RECEPTIONIST' });
    const respuestas = await fallar(user.username, 5);
    respuestas.forEach((res) => expect(res.status).toBe(401));

    const bloqueado = await login(user.username, 'Incorrecta1');
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.error.code).toBe('TOO_MANY_ATTEMPTS');
    expect(bloqueado.body.error.message).toMatch(/15 minutos/);
  });

  test('durante el bloqueo se rechaza también la contraseña correcta', async () => {
    const user = await createUser({ username: 'lucia', role: 'RECEPTIONIST' });
    await fallar(user.username, 5);
    const res = await login(user.username);
    expect(res.status).toBe(429);
    expect(res.body.data).toBeUndefined();
  });

  test('el bloqueo es por cuenta aunque se alterne entre usuario y correo', async () => {
    const user = await createUser({ username: 'lucia', email: 'lucia@taller.test', role: 'RECEPTIONIST' });
    await fallar(user.username, 3);
    await fallar(user.email, 2);
    expect((await login(user.username)).status).toBe(429);
    expect((await login(user.email)).status).toBe(429);
  });

  test('un identificador inexistente se comporta igual y no revela si la cuenta existe', async () => {
    const respuestas = await fallar('no.existe', 5);
    respuestas.forEach((res) => expect(res.status).toBe(401));
    const bloqueado = await login('no.existe', 'Incorrecta1');
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.error.code).toBe('TOO_MANY_ATTEMPTS');
  });

  test('el bloqueo de una cuenta no afecta a otras', async () => {
    const a = await createUser({ username: 'ana', role: 'RECEPTIONIST' });
    const b = await createUser({ username: 'beto', role: 'MECHANIC' });
    await fallar(a.username, 5);
    expect((await login(a.username)).status).toBe(429);
    expect((await login(b.username)).status).toBe(200);
  });

  test('al vencer el bloqueo se puede volver a iniciar sesión y el contador se reinicia', async () => {
    const user = await createUser({ username: 'lucia', role: 'RECEPTIONIST' });
    await fallar(user.username, 5);
    await pool.query('UPDATE login_attempts SET locked_until = ?', [new Date(Date.now() - 60 * 1000)]);

    expect((await login(user.username)).status).toBe(200);
    const [filas] = await pool.query('SELECT COUNT(*) AS total FROM login_attempts');
    expect(filas[0].total).toBe(0);
  });

  test('un inicio de sesión correcto reinicia el contador de fallos', async () => {
    const user = await createUser({ username: 'lucia', role: 'RECEPTIONIST' });
    await fallar(user.username, 4);
    expect((await login(user.username)).status).toBe(200);
    const despues = await fallar(user.username, 4);
    despues.forEach((res) => expect(res.status).toBe(401));
  });

  test('tras el vencimiento, un nuevo fallo empieza la cuenta desde uno', async () => {
    const user = await createUser({ username: 'lucia', role: 'RECEPTIONIST' });
    await fallar(user.username, 5);
    await pool.query('UPDATE login_attempts SET locked_until = ?', [new Date(Date.now() - 60 * 1000)]);

    const respuestas = await fallar(user.username, 4);
    respuestas.forEach((res) => expect(res.status).toBe(401));
  });

  test('una cuenta desactivada también acumula intentos sin revelar su estado', async () => {
    await createUser({ username: 'baja', role: 'MECHANIC', active: false });
    const respuestas = await fallar('baja', 5);
    respuestas.forEach((res) => expect(res.body.error.message).toBe('Credenciales incorrectas.'));
    expect((await login('baja')).status).toBe(429);
  });
});
