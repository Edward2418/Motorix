import request from 'supertest';
import app from '../../app.js';
import { closePool } from '../helpers/db.js';

afterAll(closePool);

describe('cabeceras de seguridad (helmet)', () => {
  test('toda respuesta lleva las cabeceras de protección básicas', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['strict-transport-security']).toMatch(/max-age=/);
    expect(res.headers['referrer-policy']).toBeDefined();
  });

  test('no revela la tecnología del servidor', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('las respuestas de error también llevan las cabeceras', async () => {
    const res = await request(app).get('/api/ruta-que-no-existe');

    expect(res.status).toBe(404);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('orígenes permitidos (CORS)', () => {
  test('un origen local de desarrollo recibe el permiso', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5000');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5000');
  });

  test('un origen desconocido no recibe el permiso (ya no se responde con «*»)', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://sitio-malicioso.example');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('una petición sin origen (aplicación de escritorio, curl) funciona', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('la verificación previa (preflight) de un origen local se acepta', async () => {
    const res = await request(app)
      .options('/api/health')
      .set('Origin', 'http://localhost:5000')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5000');
  });

  test('la verificación previa de un origen desconocido no recibe el permiso', async () => {
    const res = await request(app)
      .options('/api/health')
      .set('Origin', 'https://sitio-malicioso.example')
      .set('Access-Control-Request-Method', 'GET');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
