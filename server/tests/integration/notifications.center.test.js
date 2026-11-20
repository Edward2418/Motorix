import request from 'supertest';
import app from '../../app.js';
import { createPart, resetTables, closePool } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

const centro = async (token) => (await request(app).get('/api/notifications').set(bearer(token))).body.data;
const grupo = (data, type) => data.groups.find((g) => g.type === type);

describe('centro de notificaciones del administrador (avisos de stock)', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('una refacción con stock bajo y otra agotada generan STOCK_LOW y STOCK_OUT con su total', async () => {
    const { token } = await loginAs('ADMIN');
    const baja = await createPart({ code: 'LOW-1', name: 'Bujía de iridio', stock: 3, minStock: 3 });
    const agotada = await createPart({ code: 'OUT-1', name: 'Filtro de aceite', stock: 0, minStock: 3 });

    const data = await centro(token);

    expect(grupo(data, 'STOCK_LOW')).toMatchObject({ total: 1, unread: 1 });
    expect(grupo(data, 'STOCK_OUT')).toMatchObject({ total: 1, unread: 1 });
    expect(grupo(data, 'STOCK_LOW').items[0]).toMatchObject({
      key: `STOCK:${baja.id}`,
      type: 'STOCK_LOW',
      severity: 1,
      read: false,
      target: { module: 'inventory', id: baja.id }
    });
    expect(grupo(data, 'STOCK_OUT').items[0]).toMatchObject({
      key: `STOCK:${agotada.id}`,
      type: 'STOCK_OUT',
      severity: 2,
      target: { module: 'inventory', id: agotada.id }
    });
  });

  test('unread es la suma de los no leídos de todos los grupos', async () => {
    const { token } = await loginAs('ADMIN');
    await createPart({ code: 'LOW-1', stock: 3, minStock: 3 });
    await createPart({ code: 'LOW-2', stock: 1, minStock: 3 });
    await createPart({ code: 'OUT-1', stock: 0, minStock: 3 });

    const data = await centro(token);

    expect(data.unread).toBe(3);
    expect(data.groups.reduce((suma, g) => suma + g.unread, 0)).toBe(3);
  });

  test('los grupos salen primero lo más urgente: agotadas antes que stock bajo', async () => {
    const { token } = await loginAs('ADMIN');
    await createPart({ code: 'LOW-1', stock: 3, minStock: 3 });
    await createPart({ code: 'OUT-1', stock: 0, minStock: 3 });

    const data = await centro(token);

    expect(data.groups.map((g) => g.type)).toEqual(['STOCK_OUT', 'STOCK_LOW']);
  });

  test('una refacción con stock por encima del mínimo no genera aviso', async () => {
    const { token } = await loginAs('ADMIN');
    await createPart({ code: 'OK-1', stock: 10, minStock: 3 });
    expect(await centro(token)).toEqual({ unread: 0, groups: [] });
  });

  test('una refacción inactiva no genera aviso', async () => {
    const { token } = await loginAs('ADMIN');
    await createPart({ code: 'OFF-1', stock: 0, minStock: 3, active: false });
    expect(await centro(token)).toEqual({ unread: 0, groups: [] });
  });

  test('sin avisos el resultado es { unread: 0, groups: [] }', async () => {
    const { token } = await loginAs('ADMIN');
    expect(await centro(token)).toEqual({ unread: 0, groups: [] });
  });

  test('con 12 refacciones con stock bajo el grupo trae total 12 y solo 10 elementos', async () => {
    const { token } = await loginAs('ADMIN');
    for (let i = 1; i <= 12; i += 1) {
      await createPart({ code: `LOW-${String(i).padStart(2, '0')}`, name: `Refacción ${i}`, stock: 2, minStock: 3 });
    }

    const data = await centro(token);

    expect(grupo(data, 'STOCK_LOW').total).toBe(12);
    expect(grupo(data, 'STOCK_LOW').items).toHaveLength(10);
    expect(grupo(data, 'STOCK_LOW').unread).toBe(12);
    expect(data.unread).toBe(12);
  });

  test('el aviso de stock no incluye el precio de compra', async () => {
    const { token } = await loginAs('ADMIN');
    await createPart({ code: 'LOW-1', stock: 1, minStock: 3, purchasePrice: 123.45 });

    const res = await request(app).get('/api/notifications').set(bearer(token));

    const texto = JSON.stringify(res.body);
    expect(texto).not.toContain('purchasePrice');
    expect(texto).not.toContain('123.45');
  });

  test('el contador coincide con el total de no leídos del centro', async () => {
    const { token } = await loginAs('ADMIN');
    await createPart({ code: 'LOW-1', stock: 3, minStock: 3 });
    await createPart({ code: 'OUT-1', stock: 0, minStock: 3 });

    const data = await centro(token);
    const conteo = await request(app).get('/api/notifications/count').set(bearer(token));

    expect(conteo.body.data.unread).toBe(data.unread);
  });
});
