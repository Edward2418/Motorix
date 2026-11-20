import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

// La base se limpia antes de cada prueba y la conexión se cierra una sola vez, al terminar el archivo.
beforeEach(resetTables);
afterAll(closePool);

const leer = (token) => request(app).get('/api/settings').set(bearer(token));
const guardar = (token, cuerpo) => request(app).put('/api/settings').set(bearer(token)).send(cuerpo);

const formaDeConfiguracion = {
  workshop: {
    name: expect.any(String),
    address: expect.any(String),
    phone: expect.any(String),
    source: expect.stringMatching(/^(saved|environment|default)$/)
  },
  updatedAt: null,
  updatedByName: null
};

describe('contrato de GET /api/settings', () => {
  test('responde 200 con { data: { workshop, updatedAt, updatedByName } }', async () => {
    const { token } = await loginAs('ADMIN');

    const res = await leer(token);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject(formaDeConfiguracion);
    expect(Object.keys(res.body)).toEqual(['data']);
  });

  test('sin token responde 401', async () => {
    expect((await request(app).get('/api/settings')).status).toBe(401);
  });

  test.each(['RECEPTIONIST', 'MECHANIC'])('con el rol %s responde 403', async (rol) => {
    const { token } = await loginAs(rol);
    const res = await leer(token);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('contrato de PUT /api/settings', () => {
  test('responde 200 con la configuración guardada y vigente', async () => {
    const { token } = await loginAs('ADMIN');

    const res = await guardar(token, { workshop: { name: 'Taller Contrato' } });

    expect(res.status).toBe(200);
    expect(res.body.data.workshop).toEqual({
      name: 'Taller Contrato',
      address: expect.any(String),
      phone: expect.any(String),
      source: 'saved'
    });
    expect(res.body.data.updatedAt).toEqual(expect.any(String));
    expect(res.body.data.updatedByName).toEqual(expect.any(String));
  });

  test('un dato inválido responde 400 VALIDATION_ERROR con details [{ field, message }]', async () => {
    const { token } = await loginAs('ADMIN');

    const res = await guardar(token, { workshop: { name: '' } });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual([{ field: 'workshop.name', message: expect.any(String) }]);
  });

  test('sin token responde 401', async () => {
    const res = await request(app).put('/api/settings').send({ workshop: { name: 'X' } });
    expect(res.status).toBe(401);
  });

  test.each(['RECEPTIONIST', 'MECHANIC'])('con el rol %s responde 403 y no guarda nada', async (rol) => {
    const { token } = await loginAs(rol);
    const admin = await loginAs('ADMIN');

    const res = await guardar(token, { workshop: { name: 'Intento no autorizado' } });

    expect(res.status).toBe(403);
    const consulta = await leer(admin.token);
    expect(consulta.body.data.workshop.name).not.toBe('Intento no autorizado');
  });
});
