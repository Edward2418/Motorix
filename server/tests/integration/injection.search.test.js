import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createClient, createVehicle, createPart, createMechanic, createOrder } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

beforeEach(resetTables);
afterAll(closePool);

// Texto de ataque: se debe tratar siempre como texto, nunca como parte de la consulta.
const ATAQUES = [
  "' OR 1=1 --",
  "'; DROP TABLE users; --",
  "%' UNION SELECT 1,2,3,4,5 --",
  "\\",
  '" OR ""="',
  "') OR ('1'='1",
  '%',
  '_'
];

// Ruta y parámetro de búsqueda de cada listado (clientes, vehículos, órdenes y usuarios usan `search`; refacciones y
// mantenimientos usan `q`).
const BUSQUEDAS = [
  ['/api/clients', 'search'],
  ['/api/vehicles', 'search'],
  ['/api/orders', 'search'],
  ['/api/users', 'search'],
  ['/api/parts', 'q'],
  ['/api/maintenance?status=PROGRAMADO', 'q']
];

async function datos() {
  const mecanico = await createMechanic();
  const cliente = await createClient({ name: 'Ana Pérez', phone: '5551112222' });
  const vehiculo = await createVehicle({ clientId: cliente.id, licensePlate: 'ABC1234' });
  await createOrder({ clientId: cliente.id, vehicleId: vehiculo.id, mechanicId: mecanico.id });
  await createPart({ code: 'BUJ-1', name: 'Bujía de iridio' });
  return { mecanico, cliente, vehiculo };
}

const cuentaFilas = async (tabla) => Number((await pool.query(`SELECT COUNT(*) AS total FROM ${tabla}`))[0][0].total);

describe('los campos de búsqueda tratan el texto de ataque como texto', () => {
  test.each(BUSQUEDAS)('%s (parámetro %s) responde sin error de base de datos con cada cadena de ataque', async (ruta, parametro) => {
    await datos();
    const { token } = await loginAs('ADMIN');
    const separador = ruta.includes('?') ? '&' : '?';

    for (const ataque of ATAQUES) {
      const res = await request(app).get(`${ruta}${separador}${parametro}=${encodeURIComponent(ataque)}`).set(bearer(token));
      expect({ ataque, status: res.status }).toEqual({ ataque, status: 200 });
      expect(JSON.stringify(res.body)).not.toMatch(/sql|syntax|mysql|ER_/i);
    }
  });

  test.each(BUSQUEDAS)('%s (parámetro %s): una inyección de «todo» no devuelve más resultados que una búsqueda inexistente', async (ruta, parametro) => {
    await datos();
    const { token } = await loginAs('ADMIN');
    const separador = ruta.includes('?') ? '&' : '?';
    const total = async (texto) => {
      const res = await request(app).get(`${ruta}${separador}${parametro}=${encodeURIComponent(texto)}`).set(bearer(token));
      return res.body.meta?.total ?? res.body.data.length;
    };

    const inexistente = await total('texto-que-no-existe-zzz');
    for (const ataque of ["' OR 1=1 --", "x' OR '1'='1", "%' UNION SELECT 1 --"]) {
      expect({ ataque, total: await total(ataque) }).toEqual({ ataque, total: inexistente });
    }
  });

  test('una cadena de ataque no borra ni cambia ninguna tabla', async () => {
    await datos();
    const { token } = await loginAs('ADMIN');
    const antes = { users: await cuentaFilas('users'), clients: await cuentaFilas('clients'), parts: await cuentaFilas('parts') };

    for (const [ruta, parametro] of BUSQUEDAS) {
      const separador = ruta.includes('?') ? '&' : '?';
      await request(app).get(`${ruta}${separador}${parametro}=${encodeURIComponent("'; DROP TABLE users; --")}`).set(bearer(token));
    }

    expect({ users: await cuentaFilas('users'), clients: await cuentaFilas('clients'), parts: await cuentaFilas('parts') }).toEqual(antes);
  });

  test('una búsqueda legítima con un comodín del texto se trata como texto (el % no es «todo»)', async () => {
    await datos();
    const { token } = await loginAs('ADMIN');

    const res = await request(app).get(`/api/clients?search=${encodeURIComponent('%')}`).set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  test('el inicio de sesión tampoco es inyectable por el usuario o la contraseña', async () => {
    await datos();
    const res = await request(app).post('/api/auth/login').send({ identifier: "admin' OR '1'='1", password: "x' OR '1'='1" });
    expect(res.status).toBe(401);
  });
});
