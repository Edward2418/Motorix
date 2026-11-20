import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createPart } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

const centro = async (token) => (await request(app).get('/api/notifications').set(bearer(token))).body.data;
const grupo = (data, type) => data.groups.find((g) => g.type === type);
const total = (data, type) => grupo(data, type)?.total ?? 0;

beforeEach(resetTables);
afterAll(closePool);

describe('avisos de stock del administrador', () => {
  test('stock igual al mínimo genera STOCK_LOW y stock en cero genera STOCK_OUT, con título y detalle', async () => {
    const { token } = await loginAs('ADMIN');
    await createPart({ code: 'MIN-1', name: 'Bujía', stock: 3, minStock: 3 });
    await createPart({ code: 'CERO-1', name: 'Filtro', stock: 0, minStock: 4 });

    const data = await centro(token);

    expect(grupo(data, 'STOCK_LOW').items[0].title).toBe('MIN-1 · Bujía');
    expect(grupo(data, 'STOCK_LOW').items[0].detail).toBe('Stock bajo: 3 en existencia (mínimo 3)');
    expect(grupo(data, 'STOCK_OUT').items[0].title).toBe('CERO-1 · Filtro');
    expect(grupo(data, 'STOCK_OUT').items[0].detail).toBe('Agotada: 0 en existencia (mínimo 4)');
  });

  test('una refacción inactiva no genera aviso', async () => {
    const { token } = await loginAs('ADMIN');
    await createPart({ code: 'OFF-1', stock: 0, minStock: 3, active: false });
    expect(await centro(token)).toEqual({ unread: 0, groups: [] });
  });

  test('el total de ambos grupos coincide con las alertas de Inventario y con el indicador del panel', async () => {
    const { token } = await loginAs('ADMIN');
    await createPart({ code: 'A-1', stock: 3, minStock: 3 });
    await createPart({ code: 'A-2', stock: 1, minStock: 3 });
    await createPart({ code: 'A-3', stock: 0, minStock: 3 });
    await createPart({ code: 'A-4', stock: 50, minStock: 3 });

    const avisos = await centro(token);
    const alertas = await request(app).get('/api/parts/alerts').set(bearer(token));
    const panel = await request(app).get('/api/dashboard').set(bearer(token));

    const suma = total(avisos, 'STOCK_LOW') + total(avisos, 'STOCK_OUT');
    expect(suma).toBe(3);
    expect(suma).toBe(alertas.body.data.length);
    expect(suma).toBe(panel.body.data.indicators.lowStockParts);
  });

  test('reponer el stock por encima del mínimo hace desaparecer el aviso', async () => {
    const { token } = await loginAs('ADMIN');
    const parte = await createPart({ code: 'REP-1', stock: 1, minStock: 3 });
    expect(total(await centro(token), 'STOCK_LOW')).toBe(1);

    await pool.query('UPDATE parts SET stock = 10 WHERE id = ?', [parte.id]);

    expect(await centro(token)).toEqual({ unread: 0, groups: [] });
  });

  test('una refacción agotada que se repone a nivel bajo pasa de STOCK_OUT a STOCK_LOW', async () => {
    const { token } = await loginAs('ADMIN');
    const parte = await createPart({ code: 'REP-2', stock: 0, minStock: 3 });
    expect(total(await centro(token), 'STOCK_OUT')).toBe(1);

    await pool.query('UPDATE parts SET stock = 2 WHERE id = ?', [parte.id]);

    const data = await centro(token);
    expect(total(data, 'STOCK_OUT')).toBe(0);
    expect(total(data, 'STOCK_LOW')).toBe(1);
  });

  test('el aviso no incluye el precio de compra', async () => {
    const { token } = await loginAs('ADMIN');
    await createPart({ code: 'PRE-1', stock: 0, minStock: 3, purchasePrice: 777.77 });

    const texto = JSON.stringify(await centro(token));

    expect(texto).not.toContain('purchasePrice');
    expect(texto).not.toContain('777.77');
  });
});
