import request from 'supertest';
import app from '../../app.js';
import { createPart, pool, resetTables, closePool } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

beforeEach(resetTables);
afterAll(closePool);

const centro = async (token) => (await request(app).get('/api/notifications').set(bearer(token))).body.data;
const conteo = async (token) => (await request(app).get('/api/notifications/count').set(bearer(token))).body.data.unread;
const marcar = (token, key) => request(app).post('/api/notifications/read').set(bearer(token)).send({ key });
const lecturas = async () => (await pool.query('SELECT user_id, notification_key, severity FROM notification_reads'))[0];
const fijarStock = (id, stock) => pool.query('UPDATE parts SET stock = ? WHERE id = ?', [stock, id]);
const avisoDe = (data, key) => data.groups.flatMap((g) => g.items).find((a) => a.key === key);

describe('lectura de avisos por usuario', () => {
  test('marcar un aviso baja el contador en uno y persiste en una segunda consulta', async () => {
    const { token } = await loginAs('ADMIN');
    const a = await createPart({ code: 'LOW-1', stock: 3, minStock: 3 });
    await createPart({ code: 'LOW-2', stock: 2, minStock: 3 });
    expect(await conteo(token)).toBe(2);

    const res = await marcar(token, `STOCK:${a.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.unread).toBe(1);
    expect(await conteo(token)).toBe(1);
    const data = await centro(token);
    expect(data.unread).toBe(1);
    expect(avisoDe(data, `STOCK:${a.id}`).read).toBe(true);
  });

  test('marcar dos veces el mismo aviso no duplica la lectura', async () => {
    const { token, user } = await loginAs('ADMIN');
    const a = await createPart({ code: 'LOW-1', stock: 3, minStock: 3 });

    await marcar(token, `STOCK:${a.id}`);
    await marcar(token, `STOCK:${a.id}`);

    const filas = await lecturas();
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ user_id: user.id, notification_key: `STOCK:${a.id}`, severity: 1 });
  });

  test('la lectura es por usuario: otro administrador sigue viendo el aviso sin leer', async () => {
    const primero = await loginAs('ADMIN', { username: 'admin-uno' });
    const segundo = await loginAs('ADMIN', { username: 'admin-dos' });
    const a = await createPart({ code: 'LOW-1', stock: 3, minStock: 3 });

    await marcar(primero.token, `STOCK:${a.id}`);

    expect(await conteo(primero.token)).toBe(0);
    expect(await conteo(segundo.token)).toBe(1);
    expect(avisoDe(await centro(segundo.token), `STOCK:${a.id}`).read).toBe(false);
  });

  test('un aviso leído vuelve a no leído cuando empeora (de stock bajo a agotado)', async () => {
    const { token } = await loginAs('ADMIN');
    const a = await createPart({ code: 'LOW-1', stock: 3, minStock: 3 });
    await marcar(token, `STOCK:${a.id}`);
    expect(await conteo(token)).toBe(0);

    await fijarStock(a.id, 0);

    const data = await centro(token);
    const aviso = avisoDe(data, `STOCK:${a.id}`);
    expect(aviso).toMatchObject({ type: 'STOCK_OUT', severity: 2, read: false });
    expect(data.unread).toBe(1);
    expect(await conteo(token)).toBe(1);
  });

  test('un aviso leído con la gravedad actual sigue leído aunque cambie el detalle', async () => {
    const { token } = await loginAs('ADMIN');
    const a = await createPart({ code: 'LOW-1', stock: 3, minStock: 3 });
    await marcar(token, `STOCK:${a.id}`);

    await fijarStock(a.id, 1);

    expect(avisoDe(await centro(token), `STOCK:${a.id}`).read).toBe(true);
    expect(await conteo(token)).toBe(0);
  });

  test('si la condición deja de cumplirse el aviso desaparece y su lectura se elimina; si vuelve, aparece sin leer', async () => {
    const { token } = await loginAs('ADMIN');
    const a = await createPart({ code: 'LOW-1', stock: 3, minStock: 3 });
    await marcar(token, `STOCK:${a.id}`);
    expect(await lecturas()).toHaveLength(1);

    await fijarStock(a.id, 10);
    const sinAviso = await centro(token);
    expect(sinAviso).toEqual({ unread: 0, groups: [] });
    expect(await lecturas()).toHaveLength(0);

    await fijarStock(a.id, 2);
    const denuevo = await centro(token);
    expect(avisoDe(denuevo, `STOCK:${a.id}`).read).toBe(false);
    expect(denuevo.unread).toBe(1);
  });

  test('la limpieza de un usuario no toca las lecturas de otro', async () => {
    const primero = await loginAs('ADMIN', { username: 'admin-uno' });
    const segundo = await loginAs('ADMIN', { username: 'admin-dos' });
    const a = await createPart({ code: 'LOW-1', stock: 3, minStock: 3 });
    await marcar(primero.token, `STOCK:${a.id}`);
    await marcar(segundo.token, `STOCK:${a.id}`);
    await fijarStock(a.id, 10);

    await centro(primero.token);

    const filas = await lecturas();
    expect(filas).toHaveLength(1);
    expect(filas[0].user_id).toBe(segundo.user.id);
  });

  test('con 12 avisos leídos, la limpieza no pierde los que no caben en los 10 mostrados', async () => {
    const { token } = await loginAs('ADMIN');
    const piezas = [];
    for (let i = 1; i <= 12; i += 1) {
      piezas.push(await createPart({ code: `LOW-${String(i).padStart(2, '0')}`, name: `Refacción ${i}`, stock: 2, minStock: 3 }));
    }
    for (const pieza of piezas) {
      expect((await marcar(token, `STOCK:${pieza.id}`)).status).toBe(200);
    }

    const data = await centro(token);

    expect(data.unread).toBe(0);
    expect(data.groups[0].total).toBe(12);
    expect(data.groups[0].unread).toBe(0);
    expect(await lecturas()).toHaveLength(12);
  });

  test('se puede marcar un aviso que no está entre los 10 mostrados', async () => {
    const { token } = await loginAs('ADMIN');
    const piezas = [];
    for (let i = 1; i <= 12; i += 1) {
      piezas.push(await createPart({ code: `LOW-${String(i).padStart(2, '0')}`, name: `Refacción ${i}`, stock: 2, minStock: 3 }));
    }
    const mostrados = new Set((await centro(token)).groups[0].items.map((a) => a.key));
    const oculta = piezas.find((p) => !mostrados.has(`STOCK:${p.id}`));
    expect(oculta).toBeDefined();

    const res = await marcar(token, `STOCK:${oculta.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.unread).toBe(11);
  });

  test('marcar un aviso inexistente no guarda ninguna lectura', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await marcar(token, 'STOCK:9999');
    expect(res.status).toBe(404);
    expect(await lecturas()).toHaveLength(0);
  });
});
