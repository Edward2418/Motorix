import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createTermsVersion } from '../helpers/db.js';
import { runSeeds } from '../../scripts/sqlRunner.js';

beforeEach(resetTables);
afterAll(closePool);

const pedir = () => request(app).get('/api/terms/public');

describe('consulta pública de los términos y el aviso de privacidad', () => {
  test('sin sesión devuelve la versión vigente con sus dos textos y su fecha, y nada de usuarios', async () => {
    await createTermsVersion({ termsText: 'Términos uno.', privacyText: 'Aviso uno.' });
    await createTermsVersion({ termsText: 'Términos dos.', privacyText: 'Aviso dos.' });

    const res = await pedir();

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ version: 2, termsText: 'Términos dos.', privacyText: 'Aviso dos.', publishedAt: expect.any(String) });
  });

  test('sin ninguna versión publicada devuelve null', async () => {
    const res = await pedir();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: null });
  });

  test('es solo de lectura: no admite escribir', async () => {
    for (const metodo of ['post', 'put', 'patch', 'delete']) {
      expect((await request(app)[metodo]('/api/terms/public').send({})).status).toBe(404);
    }
  });

  test('las demás rutas de términos siguen pidiendo sesión', async () => {
    expect((await request(app).get('/api/terms/current')).status).toBe(401);
    expect((await request(app).post('/api/terms/accept').send({ version: 1 })).status).toBe(401);
    expect((await request(app).get('/api/terms/acceptances')).status).toBe(401);
  });
});

describe('versión 2 del texto en los datos de ejemplo (seed 013)', () => {
  beforeEach(() => runSeeds(pool, () => {}));

  test('queda vigente la versión 2 y la 1 se conserva sin cambios', async () => {
    const [versiones] = await pool.query('SELECT version, terms_text FROM terms_versions ORDER BY version');
    expect(versiones.map((v) => v.version)).toEqual([1, 2]);
    expect(versiones[0].terms_text).toMatch(/^Términos y condiciones del servicio\./);
  });

  test('el aviso de privacidad cubre los elementos del artículo 15 de la ley', async () => {
    const { privacyText } = (await pedir()).body.data;
    for (const seccion of [
      /Responsable y domicilio/,
      /Datos personales que se tratan/,
      /datos personales sensibles/,
      /Finalidades/,
      /limitar el uso o la divulgación/,
      /acceso, rectificación, cancelación y oposición/,
      /Cambios a este aviso/
    ]) {
      expect(privacyText).toMatch(seccion);
    }
    expect(privacyText).toMatch(/datos de ejemplo/);
  });

  test('los términos tratan la confidencialidad de los datos de clientes y vehículos y la responsabilidad de la cuenta', async () => {
    const { termsText } = (await pedir()).body.data;
    expect(termsText).toMatch(/Confidencialidad de los datos de clientes y vehículos/);
    expect(termsText).toMatch(/Tu cuenta es personal/);
    expect(termsText).toMatch(/plantilla/);
  });

  test('ninguna cuenta de ejemplo trae la aceptación hecha: la verá en su primer inicio de sesión', async () => {
    const [[fila]] = await pool.query('SELECT COUNT(*) AS total FROM terms_acceptances');
    expect(Number(fila.total)).toBe(0);
  });

  test('repetir los seeds no publica otra versión', async () => {
    await runSeeds(pool, () => {});
    const [[fila]] = await pool.query('SELECT COUNT(*) AS total FROM terms_versions');
    expect(Number(fila.total)).toBe(2);
  });
});
