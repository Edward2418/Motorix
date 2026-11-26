import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { runSeeds } from '../../scripts/sqlRunner.js';
import { signToken } from '../../utils/jwt.js';

// SC-003: ningún reporte tarda 3 segundos o más con los datos de ejemplo. Las peticiones pasan por `authenticate`, así que
// también cuentan el filtro de términos. La medición con 2 000 órdenes y 5 000 movimientos está en
// `scripts/measure-reports.js` (sus tiempos van en el documento de calidad).
const LIMITE_MS = 3000;

beforeEach(async () => {
  await resetTables();
  await runSeeds(pool, () => {});
});
afterAll(closePool);

const iso = (f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
const hoy = new Date();
const RANGOS = {
  'el día de hoy': [iso(hoy), iso(hoy)],
  'la semana': [iso(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 6)), iso(hoy)],
  'el mes en curso': [iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), iso(hoy)],
  'el máximo permitido (366 días)': [iso(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 365)), iso(hoy)]
};

async function tokenAdmin() {
  const [[admin]] = await pool.query("SELECT id, role FROM users WHERE username = 'admin'");
  return signToken({ sub: admin.id, role: admin.role });
}

const medir = async (accion) => {
  const inicio = process.hrtime.bigint();
  const resultado = await accion();
  return { ms: Number(process.hrtime.bigint() - inicio) / 1e6, resultado };
};

describe('rendimiento de los reportes (SC-003)', () => {
  test.each(Object.entries(RANGOS))('el reporte de ingresos de %s carga en menos de 3 segundos', async (_nombre, [desde, hasta]) => {
    const token = await tokenAdmin();

    const { ms, resultado } = await medir(() => request(app).get(`/api/reports/income?from=${desde}&to=${hasta}`).set(bearer(token)));

    expect(resultado.status).toBe(200);
    expect(ms).toBeLessThan(LIMITE_MS);
  });

  test('la exportación a CSV del máximo rango carga en menos de 3 segundos', async () => {
    const token = await tokenAdmin();
    const [desde, hasta] = RANGOS['el máximo permitido (366 días)'];

    const { ms, resultado } = await medir(() => request(app).get(`/api/reports/income?from=${desde}&to=${hasta}&format=csv`).set(bearer(token)));

    expect(resultado.status).toBe(200);
    expect(resultado.headers['content-type']).toMatch(/text\/csv/);
    expect(ms).toBeLessThan(LIMITE_MS);
  });

  test.each(['services', 'productivity', 'parts-margin', 'inventory-turnover'])(
    'el reporte %s del máximo rango carga en menos de 3 segundos y trae datos de ejemplo',
    async (reporte) => {
      const token = await tokenAdmin();
      const [desde, hasta] = RANGOS['el máximo permitido (366 días)'];

      const { ms, resultado } = await medir(() => request(app).get(`/api/reports/${reporte}?from=${desde}&to=${hasta}`).set(bearer(token)));

      expect(resultado.status).toBe(200);
      const filas = reporte === 'parts-margin' ? resultado.body.data.items : resultado.body.data;
      expect(filas.length).toBeGreaterThan(0);
      expect(ms).toBeLessThan(LIMITE_MS);
    }
  );

  test('el panel y el centro de avisos siguen por debajo de sus límites con el filtro de términos activo', async () => {
    const token = await tokenAdmin();

    const panel = await medir(() => request(app).get('/api/dashboard').set(bearer(token)));
    const avisos = await medir(() => request(app).get('/api/notifications').set(bearer(token)));

    expect(panel.resultado.status).toBe(200);
    expect(panel.ms).toBeLessThan(LIMITE_MS);
    expect(avisos.resultado.status).toBe(200);
    expect(avisos.ms).toBeLessThan(2000);
  });
});
