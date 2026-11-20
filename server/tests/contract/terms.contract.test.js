import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createTermsVersion } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

beforeEach(resetTables);
afterAll(closePool);

describe('contrato de /api/terms', () => {
  test('GET /current: { data: { version, termsText, privacyText, publishedAt, accepted } }', async () => {
    await createTermsVersion({ termsText: 'T', privacyText: 'P' });
    const { token } = await loginAs('RECEPTIONIST', { aceptarTerminos: false });

    const res = await request(app).get('/api/terms/current').set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      version: expect.any(Number),
      termsText: 'T',
      privacyText: 'P',
      publishedAt: expect.any(String),
      accepted: false
    });
  });

  test('GET /current sin versión publicada: { data: null }', async () => {
    const { token } = await loginAs('ADMIN');
    expect((await request(app).get('/api/terms/current').set(bearer(token))).body).toEqual({ data: null });
  });

  test('POST /accept: { data: { version, acceptedAt } }; versión desactualizada 409; inválida 400', async () => {
    await createTermsVersion();
    await createTermsVersion();
    const { token } = await loginAs('RECEPTIONIST', { aceptarTerminos: false });

    const desactualizada = await request(app).post('/api/terms/accept').set(bearer(token)).send({ version: 1 });
    expect(desactualizada.status).toBe(409);
    expect(desactualizada.body.error).toEqual({ code: 'TERMS_VERSION_OUTDATED', message: expect.any(String) });

    const invalida = await request(app).post('/api/terms/accept').set(bearer(token)).send({});
    expect(invalida.status).toBe(400);
    expect(invalida.body.error.code).toBe('VALIDATION_ERROR');

    const ok = await request(app).post('/api/terms/accept').set(bearer(token)).send({ version: 2 });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toEqual({ version: 2, acceptedAt: expect.any(String) });
  });

  test('GET /acceptances: { data: [{ userId, userName, username, version, acceptedAt }], meta }', async () => {
    await createTermsVersion();
    const { token, user } = await loginAs('ADMIN');

    const res = await request(app).get('/api/terms/acceptances').set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
    expect(res.body.data[0]).toEqual({
      userId: user.id,
      userName: user.name,
      username: user.username,
      version: 1,
      acceptedAt: expect.any(String)
    });
  });

  test('sin token las tres responden 401', async () => {
    expect((await request(app).get('/api/terms/current')).status).toBe(401);
    expect((await request(app).post('/api/terms/accept').send({ version: 1 })).status).toBe(401);
    expect((await request(app).get('/api/terms/acceptances')).status).toBe(401);
  });

  test.each(['RECEPTIONIST', 'MECHANIC'])('GET /acceptances con el rol %s responde 403 FORBIDDEN', async (rol) => {
    const { token } = await loginAs(rol);
    const res = await request(app).get('/api/terms/acceptances').set(bearer(token));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
