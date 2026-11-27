import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool } from '../helpers/db.js';
import { seedDatabase, isProtectedDatabase } from '../../scripts/demoSeed.js';
import { comparePassword } from '../../utils/hash.js';

beforeEach(resetTables);
afterAll(closePool);

const silencio = () => {};
const usuarios = async () => (await pool.query('SELECT username, password_hash FROM users ORDER BY username'))[0];
const sembrar = (opciones) => seedDatabase(pool, { log: silencio, ...opciones });
const NUBE = { nodeEnv: 'production', dbHost: 'gateway01.us-east-1.prod.aws.tidbcloud.com' };

describe('cuándo una base se considera de producción', () => {
  test.each([
    ['development', 'localhost', false],
    ['test', '127.0.0.1', false],
    ['development', '::1', false],
    ['production', 'localhost', true],
    ['development', 'gateway01.tidbcloud.com', true]
  ])('NODE_ENV %s con la base en %s', (nodeEnv, dbHost, esperado) => {
    expect(isProtectedDatabase({ nodeEnv, dbHost })).toBe(esperado);
  });
});

describe('datos de ejemplo en producción', () => {
  test('sin permiso explícito no carga nada', async () => {
    await expect(sembrar(NUBE)).rejects.toThrow(/ALLOW_DEMO_DATA/);
    expect(await usuarios()).toEqual([]);
  });

  test.each([undefined, '', 'corta', 'sinmayusculas1'])('con permiso pero con la contraseña «%s» no carga nada', async (password) => {
    await expect(sembrar({ ...NUBE, allowDemoData: 'true', demoPassword: password })).rejects.toThrow(/DEMO_PASSWORD/);
    expect(await usuarios()).toEqual([]);
  });

  test('con permiso carga los datos y ninguna cuenta conserva una contraseña publicada', async () => {
    await sembrar({ ...NUBE, allowDemoData: 'true', demoPassword: 'SoloParaPruebas2026' });

    const filas = await usuarios();
    expect(filas.map((f) => f.username)).toEqual(['admin', 'mecanico', 'mecanico2', 'recepcion']);
    for (const fila of filas) {
      expect({ usuario: fila.username, nueva: await comparePassword('SoloParaPruebas2026', fila.password_hash) }).toEqual({ usuario: fila.username, nueva: true });
    }
    const res = await request(app).post('/api/auth/login').send({ identifier: 'admin', password: 'SoloParaPruebas2026' });
    expect(res.status).toBe(200);
    const [[ordenes]] = await pool.query('SELECT COUNT(*) AS total FROM service_orders');
    expect(Number(ordenes.total)).toBeGreaterThan(0);
  });

  test('repetirlo no pisa una contraseña que alguien ya cambió', async () => {
    const opciones = { ...NUBE, allowDemoData: 'true', demoPassword: 'SoloParaPruebas2026' };
    await sembrar(opciones);
    await pool.query("UPDATE users SET password_hash = 'cambiada-por-la-persona' WHERE username = 'admin'");

    await sembrar(opciones);

    expect((await usuarios()).find((f) => f.username === 'admin').password_hash).toBe('cambiada-por-la-persona');
  });
});

describe('datos de ejemplo en local', () => {
  test('se cargan como siempre, sin pedir nada', async () => {
    await sembrar({ nodeEnv: 'development', dbHost: 'localhost' });
    expect(await usuarios()).toHaveLength(4);
  });
});
