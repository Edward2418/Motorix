import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createPart, pool } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';
import { leerCsv, pedirCsv } from '../helpers/csv.js';

beforeEach(resetTables);
afterAll(closePool);

const OCTUBRE = 'from=2026-10-01&to=2026-10-31';
const pedir = (token, extra = '') => request(app).get(`/api/reports/inventory-turnover?${OCTUBRE}${extra}`).set(bearer(token));

// Escribe un movimiento con su fecha: la rotación reconstruye la existencia a partir de ellos.
async function movimiento(partId, type, quantity, stockAfter, fecha, orderId = null) {
  const [[usuario]] = await pool.query('SELECT id FROM users ORDER BY id LIMIT 1');
  await pool.query(
    "INSERT INTO inventory_movements (part_id, type, quantity, stock_after, reason, order_id, created_by, created_at) VALUES (?, ?, ?, ?, 'Prueba', ?, ?, ?)",
    [partId, type, quantity, stockAfter, orderId, usuario.id, fecha]
  );
}

const parte = (code, name) => createPart({ code, name, stock: 0 });

async function escenario() {
  const { orden, tokens } = await escenarioOrden('TERMINADO');
  // Bujía: 10 antes del rango, salen 4 dentro, entra más después. Promedio (10 + 6) / 2 = 8, rotación 0.5.
  const bujia = await parte('BUJ', 'Bujía');
  await movimiento(bujia.id, 'ENTRADA', 10, 10, '2026-09-20 10:00:00');
  await movimiento(bujia.id, 'SALIDA', -3, 7, '2026-10-01 00:00:00', orden.id);
  await movimiento(bujia.id, 'SALIDA', -1, 6, '2026-10-31 23:59:59', orden.id);
  await movimiento(bujia.id, 'ENTRADA', 50, 56, '2026-11-01 00:00:00');
  // Filtro: tiene existencia y no se movió. Rotación 0.
  const filtro = await parte('FIL', 'Filtro');
  await movimiento(filtro.id, 'ENTRADA', 5, 5, '2026-09-01 10:00:00');
  // Banda: entra y sale todo dentro del rango. Existencia promedio 0.
  const banda = await parte('BAN', 'Banda');
  await movimiento(banda.id, 'ENTRADA', 2, 2, '2026-10-02 10:00:00');
  await movimiento(banda.id, 'SALIDA', -2, 0, '2026-10-03 10:00:00', orden.id);
  // Nueva: entra después del rango. No aparece.
  const nueva = await parte('NUE', 'Nueva');
  await movimiento(nueva.id, 'ENTRADA', 9, 9, '2026-11-05 10:00:00');
  return { bujia, filtro, banda, tokens };
}

describe('rotación de inventario', () => {
  test('suma las salidas del rango y calcula la existencia promedio con la inicial y la final', async () => {
    const { bujia, filtro, banda, tokens } = await escenario();

    const res = await pedir(tokens.admin);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { partId: bujia.id, code: 'BUJ', name: 'Bujía', unitsOut: 4, averageStock: 8, turnover: 0.5 },
      { partId: banda.id, code: 'BAN', name: 'Banda', unitsOut: 2, averageStock: 0, turnover: null },
      { partId: filtro.id, code: 'FIL', name: 'Filtro', unitsOut: 0, averageStock: 5, turnover: 0 }
    ]);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 50, total: 3 });
  });

  test('pagina los resultados', async () => {
    const { tokens } = await escenario();

    const res = await pedir(tokens.admin, '&pageSize=2&page=2');

    expect(res.body.data.map((f) => f.code)).toEqual(['FIL']);
    expect(res.body.meta).toEqual({ page: 2, pageSize: 2, total: 3 });
  });

  test('sin refacciones devuelve una lista vacía', async () => {
    const { token } = await loginAs('ADMIN');
    expect((await pedir(token)).body.data).toEqual([]);
  });

  test('el CSV coincide con el JSON', async () => {
    const { tokens } = await escenario();

    const res = await pedirCsv(tokens.admin, `/api/reports/inventory-turnover?${OCTUBRE}&pageSize=1`);

    expect(res.headers['content-disposition']).toBe('attachment; filename="rotacion-2026-10-01-a-2026-10-31.csv"');
    expect(leerCsv(res.body)).toEqual([
      ['Código', 'Refacción', 'Unidades que salieron', 'Existencia promedio', 'Rotación'],
      ['BUJ', 'Bujía', '4', '8.00', '0.50'],
      ['BAN', 'Banda', '2', '0.00', 'Sin existencia'],
      ['FIL', 'Filtro', '0', '5.00', '0.00']
    ]);
  });

  test.each(['RECEPTIONIST', 'MECHANIC'])('el rol %s recibe 403', async (rol) => {
    const { token } = await loginAs(rol);
    expect((await pedir(token)).status).toBe(403);
  });
});
