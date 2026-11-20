import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createTermsVersion } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

beforeEach(resetTables);
afterAll(closePool);

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// SC-005: con términos pendientes, TODAS las rutas protegidas responden 403 TERMS_NOT_ACCEPTED. La lista sale de lo que
// routes/index.js registra (no de una lista escrita a mano), así un router nuevo queda cubierto sin tocar esta prueba.
// Quedan fuera solo el inicio de sesión, la salud del servicio y las dos rutas de términos que el usuario necesita.
async function prefijosRegistrados() {
  const texto = await readFile(path.join(raiz, 'routes/index.js'), 'utf8');
  return [...texto.matchAll(/router\.use\('\/([a-z-]+)',\s*\w+\)/g)].map((m) => m[1]);
}

const EXCLUIDOS = new Set(['auth', 'terms']);

const bloqueo = (res, ruta) => {
  expect({ ruta, status: res.status, code: res.body?.error?.code }).toEqual({ ruta, status: 403, code: 'TERMS_NOT_ACCEPTED' });
};

describe('con términos pendientes se bloquea todo lo protegido', () => {
  test('la lista de rutas se obtiene de routes/index.js y no está vacía', async () => {
    const prefijos = await prefijosRegistrados();
    expect(prefijos.length).toBeGreaterThan(10);
    expect(prefijos).toEqual(expect.arrayContaining(['clients', 'orders', 'users', 'settings', 'audit-log', 'terms', 'auth']));
  });

  test('cada router protegido (menos auth y terms) responde 403 TERMS_NOT_ACCEPTED, con cualquier rol', async () => {
    await createTermsVersion();
    const prefijos = (await prefijosRegistrados()).filter((p) => !EXCLUIDOS.has(p));

    for (const rol of ['ADMIN', 'RECEPTIONIST', 'MECHANIC']) {
      const { token } = await loginAs(rol, { aceptarTerminos: false });
      for (const prefijo of prefijos) {
        // Los routers aplican `authenticate` a todo su contenido, así que basta la raíz; GET y POST cubren lectura y escritura.
        bloqueo(await request(app).get(`/api/${prefijo}`).set(bearer(token)), `${rol} GET /api/${prefijo}`);
        bloqueo(await request(app).post(`/api/${prefijo}`).set(bearer(token)).send({}), `${rol} POST /api/${prefijo}`);
      }
    }
  });

  test('rutas concretas conocidas también responden 403 (listas, detalle, escritura y las de auth)', async () => {
    await createTermsVersion();
    const { token } = await loginAs('ADMIN', { aceptarTerminos: false });
    const concretas = [
      ['get', '/api/auth/me'],
      ['put', '/api/auth/password'],
      ['get', '/api/orders/1'],
      ['get', '/api/clients/1'],
      ['get', '/api/parts/alerts'],
      ['get', '/api/notifications/count'],
      ['get', '/api/settings'],
      ['put', '/api/settings'],
      ['get', '/api/audit-log'],
      ['get', '/api/terms/acceptances']
    ];

    for (const [metodo, ruta] of concretas) {
      bloqueo(await request(app)[metodo](ruta).set(bearer(token)).send({}), `${metodo.toUpperCase()} ${ruta}`);
    }
  });

  test('las dos rutas de términos que el usuario necesita responden normal', async () => {
    await createTermsVersion();
    const { token } = await loginAs('RECEPTIONIST', { aceptarTerminos: false });

    expect((await request(app).get('/api/terms/current').set(bearer(token))).status).toBe(200);
    expect((await request(app).post('/api/terms/accept').set(bearer(token)).send({ version: 1 })).status).toBe(200);
  });

  test('el inicio de sesión y la salud del servicio no se bloquean', async () => {
    await createTermsVersion();
    expect((await request(app).get('/api/health')).status).toBe(200);
    const { user } = await loginAs('ADMIN', { aceptarTerminos: false });
    const res = await request(app).post('/api/auth/login').send({ identifier: user.username, password: 'Prueba2026!' });
    expect(res.status).toBe(200);
  });

  test('sin versión publicada ninguna ruta se bloquea', async () => {
    const { token } = await loginAs('ADMIN', { aceptarTerminos: false });
    for (const ruta of ['/api/clients', '/api/orders', '/api/users', '/api/settings', '/api/auth/me']) {
      const res = await request(app).get(ruta).set(bearer(token));
      expect({ ruta, status: res.status }).toEqual({ ruta, status: 200 });
    }
  });

  test('ya aceptados los términos, las rutas vuelven a funcionar', async () => {
    await createTermsVersion();
    const { token } = await loginAs('RECEPTIONIST', { aceptarTerminos: false });
    bloqueo(await request(app).get('/api/clients').set(bearer(token)), 'antes de aceptar');

    await request(app).post('/api/terms/accept').set(bearer(token)).send({ version: 1 });

    expect((await request(app).get('/api/clients').set(bearer(token))).status).toBe(200);
  });
});

describe('ningún archivo de rutas se salta el filtro', () => {
  test('todos los archivos de rutas, salvo auth y terms, aplican authenticate', async () => {
    const archivos = (await readdir(path.join(raiz, 'routes'))).filter((f) => f.endsWith('Routes.js') && !['authRoutes.js', 'termsRoutes.js'].includes(f));
    expect(archivos.length).toBeGreaterThan(10);
    const sinFiltro = [];
    for (const archivo of archivos) {
      const texto = await readFile(path.join(raiz, 'routes', archivo), 'utf8');
      if (!/router\.use\(authenticate\b/.test(texto)) {
        sinFiltro.push(archivo);
      }
      expect({ archivo, ignoraTerminos: /authenticateIgnoringTerms/.test(texto) }).toEqual({ archivo, ignoraTerminos: false });
    }
    expect(sinFiltro).toEqual([]);
  });

  test('solo termsRoutes usa authenticateIgnoringTerms', async () => {
    const usan = [];
    for (const archivo of await readdir(path.join(raiz, 'routes'))) {
      if (/authenticateIgnoringTerms/.test(await readFile(path.join(raiz, 'routes', archivo), 'utf8'))) {
        usan.push(archivo);
      }
    }
    expect(usan).toEqual(['termsRoutes.js']);
  });
});
