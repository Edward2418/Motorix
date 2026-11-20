import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createUser, createTermsVersion, TEST_PASSWORD } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

beforeEach(resetTables);
afterAll(closePool);

const actual = (token) => request(app).get('/api/terms/current').set(bearer(token));
const aceptar = (token, version) => request(app).post('/api/terms/accept').set(bearer(token)).send({ version });
const iniciarSesion = (username) => request(app).post('/api/auth/login').send({ identifier: username, password: TEST_PASSWORD });
const filas = async () => (await pool.query('SELECT * FROM terms_acceptances'))[0];

describe('GET /api/terms/current', () => {
  test('devuelve la versión vigente, los dos textos y que el usuario aún no la aceptó', async () => {
    await createTermsVersion({ termsText: 'Texto de términos', privacyText: 'Texto de privacidad' });
    const { token } = await loginAs('RECEPTIONIST', { aceptarTerminos: false });

    const res = await actual(token);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      version: 1,
      termsText: 'Texto de términos',
      privacyText: 'Texto de privacidad',
      publishedAt: expect.any(String),
      accepted: false
    });
  });

  test('con varias versiones devuelve la de mayor número', async () => {
    await createTermsVersion({ termsText: 'viejos' });
    await createTermsVersion({ termsText: 'nuevos' });
    const { token } = await loginAs('MECHANIC', { aceptarTerminos: false });

    const res = await actual(token);

    expect(res.body.data.version).toBe(2);
    expect(res.body.data.termsText).toBe('nuevos');
  });

  test('responde data null cuando no hay ninguna versión publicada', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await actual(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: null });
  });

  test('sin token responde 401', async () => {
    expect((await request(app).get('/api/terms/current')).status).toBe(401);
  });
});

describe('POST /api/terms/accept', () => {
  test('guarda usuario, versión y fecha, y después current responde accepted true', async () => {
    const version = await createTermsVersion();
    const { token, user } = await loginAs('RECEPTIONIST', { aceptarTerminos: false });

    const res = await aceptar(token, 1);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ version: 1, acceptedAt: expect.any(String) });
    const guardadas = await filas();
    expect(guardadas).toHaveLength(1);
    expect(guardadas[0]).toMatchObject({ user_id: user.id, terms_version_id: version.id });
    expect(guardadas[0].accepted_at).toBeInstanceOf(Date);
    expect((await actual(token)).body.data.accepted).toBe(true);
  });

  test('aceptar dos veces la misma versión responde igual y no duplica el registro', async () => {
    await createTermsVersion();
    const { token } = await loginAs('RECEPTIONIST', { aceptarTerminos: false });

    const primera = await aceptar(token, 1);
    const segunda = await aceptar(token, 1);

    expect(segunda.status).toBe(200);
    expect(segunda.body.data).toEqual(primera.body.data);
    expect(await filas()).toHaveLength(1);
  });

  test('una versión que ya no es la vigente responde 409 TERMS_VERSION_OUTDATED y no guarda nada', async () => {
    await createTermsVersion();
    await createTermsVersion();
    const { token } = await loginAs('RECEPTIONIST', { aceptarTerminos: false });

    const res = await aceptar(token, 1);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TERMS_VERSION_OUTDATED');
    expect(await filas()).toHaveLength(0);
  });

  test('una versión inexistente responde 400 VALIDATION_ERROR', async () => {
    await createTermsVersion();
    const { token } = await loginAs('RECEPTIONIST', { aceptarTerminos: false });

    const res = await aceptar(token, 99);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test.each([[undefined], [0], [-1], [1.5], ['uno'], [null]])('una versión inválida (%p) responde 400', async (valor) => {
    await createTermsVersion();
    const { token } = await loginAs('RECEPTIONIST', { aceptarTerminos: false });
    expect((await aceptar(token, valor)).status).toBe(400);
  });

  test('al publicar una versión nueva se vuelve a exigir aunque ya hubiera aceptado la anterior', async () => {
    await createTermsVersion();
    const { token } = await loginAs('RECEPTIONIST', { aceptarTerminos: false });
    await aceptar(token, 1);
    expect((await request(app).get('/api/clients').set(bearer(token))).status).toBe(200);

    await createTermsVersion();

    const bloqueada = await request(app).get('/api/clients').set(bearer(token));
    expect(bloqueada.status).toBe(403);
    expect(bloqueada.body.error.code).toBe('TERMS_NOT_ACCEPTED');
    expect((await aceptar(token, 2)).status).toBe(200);
    expect((await request(app).get('/api/clients').set(bearer(token))).status).toBe(200);
  });

  test('sin token responde 401', async () => {
    expect((await request(app).post('/api/terms/accept').send({ version: 1 })).status).toBe(401);
  });
});

describe('el inicio de sesión informa si hay términos pendientes', () => {
  test('termsAccepted es false si hay una versión que el usuario no aceptó', async () => {
    await createTermsVersion();
    const usuario = await createUser({ username: 'lucia', role: 'RECEPTIONIST' });

    const res = await iniciarSesion(usuario.username);

    expect(res.status).toBe(200);
    expect(res.body.data.termsAccepted).toBe(false);
  });

  test('termsAccepted es true si ya aceptó la vigente', async () => {
    await createTermsVersion();
    const { user } = await loginAs('RECEPTIONIST');
    expect((await iniciarSesion(user.username)).body.data.termsAccepted).toBe(true);
  });

  test('termsAccepted es true cuando no hay ninguna versión publicada', async () => {
    const usuario = await createUser({ username: 'lucia', role: 'RECEPTIONIST' });
    expect((await iniciarSesion(usuario.username)).body.data.termsAccepted).toBe(true);
  });
});
