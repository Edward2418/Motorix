import request from 'supertest';
import app from '../../app.js';
import { createPart, resetTables, closePool } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

// La base se limpia antes de cada prueba y la conexión se cierra una sola vez, al terminar el archivo.
beforeEach(resetTables);
afterAll(closePool);

const marcar = (token, cuerpo) => request(app).post('/api/notifications/read').set(bearer(token)).send(cuerpo);

describe('contrato de POST /api/notifications/read', () => {
  test('responde 200 con { data: { key, read: true, unread } }', async () => {
    const { token } = await loginAs('ADMIN');
    const pieza = await createPart({ code: 'LOW-1', stock: 3, minStock: 3 });
    await createPart({ code: 'LOW-2', stock: 2, minStock: 3 });

    const res = await marcar(token, { key: `STOCK:${pieza.id}` });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { key: `STOCK:${pieza.id}`, read: true, unread: 1 } });
  });

  test.each([
    ['una clave sin el formato TIPO:id', { key: 'cualquier cosa' }],
    ['un prefijo desconocido', { key: 'OTRO:3' }],
    ['un id que no es número', { key: 'STOCK:abc' }],
    ['un cuerpo sin clave', {}],
    ['una clave que no es texto', { key: 12 }],
    ['una clave de más de 60 caracteres', { key: `STOCK:${'9'.repeat(60)}` }]
  ])('responde 400 VALIDATION_ERROR con %s', async (_nombre, cuerpo) => {
    const { token } = await loginAs('ADMIN');
    const res = await marcar(token, cuerpo);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual([{ field: 'key', message: expect.any(String) }]);
  });

  test('una clave bien formada de un aviso que no existe responde 404 NOTIFICATION_NOT_FOUND', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await marcar(token, { key: 'STOCK:9999' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOTIFICATION_NOT_FOUND');
    expect(res.body.error.message).toBe('El aviso no existe o no te corresponde.');
  });

  test('sin token responde 401', async () => {
    const res = await request(app).post('/api/notifications/read').send({ key: 'STOCK:1' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});
