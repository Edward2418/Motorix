import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createUser, createTermsVersion, acceptTerms } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

beforeEach(resetTables);
afterAll(closePool);

const consultar = (token, consulta = '') => request(app).get(`/api/terms/acceptances${consulta}`).set(bearer(token));

// Escenario: dos versiones y tres personas con aceptaciones en fechas distintas.
async function escenario() {
  const v1 = await createTermsVersion();
  const v2 = await createTermsVersion();
  const { token, user: admin } = await loginAs('ADMIN', { aceptarTerminos: false });
  const lucia = await createUser({ username: 'lucia', name: 'Lucía Pérez', role: 'RECEPTIONIST' });
  const pedro = await createUser({ username: 'pedro', name: 'Pedro Ruiz', role: 'MECHANIC' });
  const poner = (userId, versionId, fecha) =>
    pool.query('INSERT INTO terms_acceptances (user_id, terms_version_id, accepted_at) VALUES (?, ?, ?)', [userId, versionId, fecha]);
  await poner(lucia.id, v1.id, new Date('2026-11-01T10:00:00'));
  await poner(lucia.id, v2.id, new Date('2026-11-10T10:00:00'));
  await poner(pedro.id, v2.id, new Date('2026-11-05T10:00:00'));
  await acceptTerms(admin.id, v2.id);
  return { token, admin, lucia, pedro };
}

describe('GET /api/terms/acceptances', () => {
  test('lista usuario, nombre, versión y fecha, de la más reciente a la más antigua', async () => {
    const { token, lucia } = await escenario();

    const res = await consultar(token);

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(4);
    expect(res.body.data[0].username).toBe('admin');
    const fila = res.body.data.find((item) => item.userId === lucia.id && item.version === 2);
    expect(fila).toMatchObject({ username: 'lucia', userName: 'Lucía Pérez', version: 2 });
    const fechas = res.body.data.map((fila) => new Date(fila.acceptedAt).getTime());
    expect(fechas).toEqual([...fechas].sort((a, b) => b - a));
  });

  test('filtra por versión', async () => {
    const { token } = await escenario();
    const res = await consultar(token, '?version=1');
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data.every((fila) => fila.version === 1)).toBe(true);
  });

  test('filtra por usuario', async () => {
    const { token, pedro } = await escenario();
    const res = await consultar(token, `?userId=${pedro.id}`);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0].username).toBe('pedro');
  });

  test('combina versión y usuario', async () => {
    const { token, lucia } = await escenario();
    const res = await consultar(token, `?version=2&userId=${lucia.id}`);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ username: 'lucia', version: 2 });
  });

  test('pagina con page y pageSize', async () => {
    const { token } = await escenario();
    const primera = await consultar(token, '?pageSize=3&page=1');
    const segunda = await consultar(token, '?pageSize=3&page=2');
    expect(primera.body.data).toHaveLength(3);
    expect(segunda.body.data).toHaveLength(1);
    expect(segunda.body.meta).toEqual({ page: 2, pageSize: 3, total: 4 });
  });

  test.each([['?version=abc'], ['?userId=0'], ['?page=0'], ['?pageSize=101']])('%s responde 400 VALIDATION_ERROR', async (consulta) => {
    const { token } = await escenario();
    const res = await consultar(token, consulta);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test.each(['RECEPTIONIST', 'MECHANIC'])('el rol %s recibe 403', async (rol) => {
    await createTermsVersion();
    const { token } = await loginAs(rol);
    expect((await consultar(token)).status).toBe(403);
  });
});
