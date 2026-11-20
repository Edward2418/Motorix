import request from 'supertest';
import app from '../../app.js';
import { env } from '../../config/env.js';
import { pool, resetTables, closePool } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';
import { escenarioPago } from '../helpers/payments.js';

beforeEach(resetTables);
afterAll(closePool);

const leer = (token) => request(app).get('/api/settings').set(bearer(token));
const guardar = (token, cuerpo) => request(app).put('/api/settings').set(bearer(token)).send(cuerpo);
const generarTicket = (token, orderId) => request(app).post(`/api/orders/${orderId}/ticket`).set(bearer(token));
const consultarTicket = (token, orderId) => request(app).get(`/api/orders/${orderId}/ticket`).set(bearer(token));

const NUEVO = { name: 'Taller Los Pinos', address: 'Calle Pinos 45, Puebla', phone: '222 123 4567' };

describe('datos del taller: consulta', () => {
  test('sin nada guardado devuelve los valores del servidor o los predeterminados, indicando de dónde vienen', async () => {
    const { token } = await loginAs('ADMIN');

    const res = await leer(token);

    expect(res.status).toBe(200);
    expect(res.body.data.workshop).toMatchObject({
      name: env.workshop.name,
      address: env.workshop.address,
      phone: env.workshop.phone
    });
    expect(['environment', 'default']).toContain(res.body.data.workshop.source);
    expect(res.body.data.updatedAt).toBeNull();
    expect(res.body.data.updatedByName).toBeNull();
  });

  test('tras guardar devuelve los datos nuevos con source saved, quién los guardó y cuándo', async () => {
    const { token } = await loginAs('ADMIN');

    const guardado = await guardar(token, { workshop: NUEVO });

    expect(guardado.status).toBe(200);
    expect(guardado.body.data.workshop).toEqual({ ...NUEVO, source: 'saved' });
    expect(guardado.body.data.updatedByName).toBe('Usuario admin');
    expect(guardado.body.data.updatedAt).toEqual(expect.any(String));
    const consulta = await leer(token);
    expect(consulta.body.data.workshop).toEqual({ ...NUEVO, source: 'saved' });
  });

  test('se puede cambiar un solo dato y los demás conservan su valor', async () => {
    const { token } = await loginAs('ADMIN');
    await guardar(token, { workshop: NUEVO });

    const res = await guardar(token, { workshop: { phone: '55 9999 8888' } });

    expect(res.body.data.workshop).toEqual({ name: NUEVO.name, address: NUEVO.address, phone: '55 9999 8888', source: 'saved' });
  });

  test('recorta los espacios de los datos', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await guardar(token, { workshop: { name: '  Taller Centro  ' } });
    expect(res.body.data.workshop.name).toBe('Taller Centro');
  });
});

describe('datos del taller: validación', () => {
  test.each([
    ['un nombre vacío', { name: '' }, 'workshop.name'],
    ['un nombre de solo espacios', { name: '   ' }, 'workshop.name'],
    ['un nombre de más de 100 caracteres', { name: 'a'.repeat(101) }, 'workshop.name'],
    ['una dirección de más de 200 caracteres', { address: 'a'.repeat(201) }, 'workshop.address'],
    ['un teléfono vacío', { phone: '' }, 'workshop.phone'],
    ['un teléfono de más de 30 caracteres', { phone: '5'.repeat(31) }, 'workshop.phone'],
    ['un nombre que no es texto', { name: 123 }, 'workshop.name']
  ])('responde 400 VALIDATION_ERROR con %s, con el detalle por campo', async (_nombre, grupo, campo) => {
    const { token } = await loginAs('ADMIN');

    const res = await guardar(token, { workshop: grupo });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toContain(campo);
  });

  test('los límites exactos se aceptan (100, 200 y 30 caracteres)', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await guardar(token, { workshop: { name: 'a'.repeat(100), address: 'b'.repeat(200), phone: '5'.repeat(30) } });
    expect(res.status).toBe(200);
  });

  test('si un dato es inválido no se guarda ningún otro (todo o nada)', async () => {
    const { token } = await loginAs('ADMIN');

    const res = await guardar(token, { workshop: { name: 'Nombre válido', phone: '5'.repeat(31) } });

    expect(res.status).toBe(400);
    const consulta = await leer(token);
    expect(consulta.body.data.workshop.name).toBe(env.workshop.name);
    expect(consulta.body.data.workshop.source).not.toBe('saved');
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM settings');
    expect(Number(total)).toBe(0);
  });

  test.each([
    ['un cuerpo vacío', {}],
    ['un grupo desconocido', { smtp: { password: 'x' } }],
    ['un campo desconocido del taller', { workshop: { color: 'rojo' } }],
    ['un grupo del taller vacío', { workshop: {} }]
  ])('responde 400 con %s', async (_nombre, cuerpo) => {
    const { token } = await loginAs('ADMIN');
    const res = await guardar(token, cuerpo);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('datos del taller en el ticket', () => {
  test('un ticket generado después del cambio muestra los datos nuevos', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'TERMINADO', total: 500 });
    await guardar(tokens.admin, { workshop: NUEVO });

    const res = await generarTicket(tokens.recepcion, orden.id);

    expect(res.status).toBe(201);
    expect(res.body.data.workshop).toEqual(NUEVO);
  });

  test('un ticket emitido antes conserva los datos con los que se emitió', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'TERMINADO', total: 500 });
    const emitido = await generarTicket(tokens.recepcion, orden.id);
    const antes = emitido.body.data.workshop;

    await guardar(tokens.admin, { workshop: NUEVO });

    const consulta = await consultarTicket(tokens.recepcion, orden.id);
    expect(consulta.body.data.workshop).toEqual(antes);
    expect(consulta.body.data.workshop.name).not.toBe(NUEVO.name);
  });

  test('un ticket anterior al Sprint 5 (sin contenido guardado) se arma con los datos vigentes', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'TERMINADO', total: 500 });
    await generarTicket(tokens.recepcion, orden.id);
    await pool.query('UPDATE tickets SET content = NULL WHERE order_id = ?', [orden.id]);

    await guardar(tokens.admin, { workshop: NUEVO });

    const consulta = await consultarTicket(tokens.recepcion, orden.id);
    expect(consulta.body.data.workshop).toEqual(NUEVO);
  });
});

describe('guardados simultáneos', () => {
  test('dos cambios a la vez dejan los datos de uno solo de ellos, sin mezclarlos', async () => {
    const { token } = await loginAs('ADMIN');
    const a = { name: 'Taller A', address: 'Dirección A', phone: '111' };
    const b = { name: 'Taller B', address: 'Dirección B', phone: '222' };

    const [ra, rb] = await Promise.all([guardar(token, { workshop: a }), guardar(token, { workshop: b })]);

    expect(ra.status).toBe(200);
    expect(rb.status).toBe(200);
    const final = (await leer(token)).body.data.workshop;
    const sinOrigen = { name: final.name, address: final.address, phone: final.phone };
    expect([a, b]).toContainEqual(sinOrigen);
  });
});
