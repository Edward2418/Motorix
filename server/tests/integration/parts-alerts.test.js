import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createPart } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';

afterAll(closePool);

const alertas = (token) => request(app).get('/api/parts/alerts').set(bearer(token));
const codigos = (res) => res.body.data.map((p) => p.code);

describe('alertas de stock bajo', () => {
  beforeEach(resetTables);

  test('devuelve las activas con stock igual o menor al mínimo, las agotadas primero y luego por menor existencia', async () => {
    const { token } = await loginAs('ADMIN');
    await createPart({ code: 'NORMAL', stock: 20, minStock: 5 });
    await createPart({ code: 'LIMITE', stock: 5, minStock: 5 });
    await createPart({ code: 'BAJA-2', stock: 2, minStock: 5 });
    await createPart({ code: 'AGOTADA', stock: 0, minStock: 5 });
    await createPart({ code: 'BAJA-4', stock: 4, minStock: 5 });

    const res = await alertas(token);
    expect(res.status).toBe(200);
    expect(codigos(res)).toEqual(['AGOTADA', 'BAJA-2', 'BAJA-4', 'LIMITE']);
    expect(res.body.data.map((p) => p.stockLevel)).toEqual(['AGOTADO', 'BAJO', 'BAJO', 'BAJO']);
  });

  test('con mínimo cero solo alerta al llegar a cero', async () => {
    const { token } = await loginAs('ADMIN');
    await createPart({ code: 'SIN-MIN-1', stock: 1, minStock: 0 });
    await createPart({ code: 'SIN-MIN-0', stock: 0, minStock: 0 });
    expect(codigos(await alertas(token))).toEqual(['SIN-MIN-0']);
  });

  test('las refacciones desactivadas no generan alerta', async () => {
    const { token } = await loginAs('ADMIN');
    await createPart({ code: 'INACTIVA', stock: 0, minStock: 5, active: false });
    await createPart({ code: 'ACTIVA', stock: 1, minStock: 5 });
    expect(codigos(await alertas(token))).toEqual(['ACTIVA']);
  });

  test('sin alertas devuelve una lista vacía', async () => {
    const { token } = await loginAs('ADMIN');
    await createPart({ code: 'NORMAL', stock: 20, minStock: 5 });
    const res = await alertas(token);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('consumir unidades en una orden hasta el mínimo agrega la alerta sin otra acción', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const pieza = await createPart({ code: 'BUJ-01', stock: 8, minStock: 5 });
    expect(codigos(await alertas(tokens.admin))).toEqual([]);

    const res = await request(app).post(`/api/orders/${orden.id}/parts`).set(bearer(tokens.mecanico)).send({ partId: pieza.id, quantity: 3 });
    expect(res.status).toBe(201);
    expect(codigos(await alertas(tokens.admin))).toEqual(['BUJ-01']);
  });

  test('una entrada que sube el stock por encima del mínimo quita la alerta', async () => {
    const { token } = await loginAs('ADMIN');
    const pieza = await createPart({ code: 'BUJ-01', stock: 2, minStock: 5 });
    expect(codigos(await alertas(token))).toEqual(['BUJ-01']);

    await request(app).post(`/api/parts/${pieza.id}/movements`).set(bearer(token)).send({ type: 'ENTRADA', quantity: 4, reason: 'Compra' });
    expect(codigos(await alertas(token))).toEqual([]);
  });

  test('desactivar la refacción en alerta la quita de la lista', async () => {
    const { token } = await loginAs('ADMIN');
    const pieza = await createPart({ code: 'BUJ-01', stock: 0, minStock: 5 });
    await request(app).patch(`/api/parts/${pieza.id}/status`).set(bearer(token)).send({ active: false });
    expect(codigos(await alertas(token))).toEqual([]);
  });

  test('el filtro lowStock del listado coincide con las alertas', async () => {
    const { token } = await loginAs('ADMIN');
    await createPart({ code: 'NORMAL', stock: 20, minStock: 5 });
    await createPart({ code: 'BAJA', stock: 2, minStock: 5 });
    await createPart({ code: 'INACTIVA', stock: 0, minStock: 5, active: false });

    const listado = await request(app).get('/api/parts?lowStock=true').set(bearer(token));
    expect(codigos(listado).sort()).toEqual(codigos(await alertas(token)).sort());
    expect(codigos(listado)).toEqual(['BAJA']);
  });

  test('solo el administrador ve las alertas; recepción y mecánico reciben 403 y sin sesión 401', async () => {
    await createPart({ code: 'BAJA', stock: 0, minStock: 5 });
    for (const rol of ['RECEPTIONIST', 'MECHANIC']) {
      const { token } = await loginAs(rol, { username: `prueba.${rol.toLowerCase()}` });
      expect({ rol, status: (await alertas(token)).status }).toEqual({ rol, status: 403 });
    }
    expect((await request(app).get('/api/parts/alerts')).status).toBe(401);
  });
});
