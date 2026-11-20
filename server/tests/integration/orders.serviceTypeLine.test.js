import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createServiceType } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';

beforeEach(resetTables);
afterAll(closePool);

const agregar = (token, orderId, cuerpo, tipo = 'services') => request(app).post(`/api/orders/${orderId}/${tipo}`).set(bearer(token)).send(cuerpo);
const editar = (token, orderId, lineId, cuerpo, tipo = 'services') =>
  request(app).put(`/api/orders/${orderId}/${tipo}/${lineId}`).set(bearer(token)).send(cuerpo);
const lineaEnBase = async (id) => (await pool.query('SELECT service_type_id FROM order_services WHERE id = ?', [id]))[0][0];

describe('líneas de servicio con tipo', () => {
  test('POST acepta serviceTypeId opcional y lo devuelve en la línea con el nombre del tipo', async () => {
    const { orden, tokens } = await escenarioOrden();
    const tipo = await createServiceType({ name: 'Cambio de aceite' });

    const res = await agregar(tokens.admin, orden.id, { description: 'Cambio de aceite', amount: 500, serviceTypeId: tipo.id });

    expect(res.status).toBe(201);
    expect(res.body.data.services).toEqual([
      { id: expect.any(Number), description: 'Cambio de aceite', amount: 500, serviceTypeId: tipo.id, serviceTypeName: 'Cambio de aceite' }
    ]);
  });

  test('sin serviceTypeId la línea queda con tipo nulo', async () => {
    const { orden, tokens } = await escenarioOrden();

    const res = await agregar(tokens.admin, orden.id, { description: 'Diagnóstico', amount: 200 });

    expect(res.status).toBe(201);
    expect(res.body.data.services[0]).toMatchObject({ serviceTypeId: null, serviceTypeName: null });
  });

  test('serviceTypeId null explícito equivale a no indicar tipo', async () => {
    const { orden, tokens } = await escenarioOrden();
    const res = await agregar(tokens.admin, orden.id, { description: 'Diagnóstico', amount: 200, serviceTypeId: null });
    expect(res.status).toBe(201);
    expect(res.body.data.services[0].serviceTypeId).toBeNull();
  });

  test('el mecánico asignado también puede indicar el tipo; otro mecánico sigue recibiendo 403', async () => {
    const { orden, tokens } = await escenarioOrden();
    const tipo = await createServiceType();

    const propio = await agregar(tokens.mecanico, orden.id, { description: 'Servicio', amount: 100, serviceTypeId: tipo.id });
    const ajeno = await agregar(tokens.otro, orden.id, { description: 'Servicio', amount: 100, serviceTypeId: tipo.id });

    expect(propio.status).toBe(201);
    expect(ajeno.status).toBe(403);
  });

  test.each([[9999], ['abc'], [0], [-1], [1.5]])('un tipo inválido o inexistente (%p) en una línea nueva responde 400', async (valor) => {
    const { orden, tokens } = await escenarioOrden();
    const res = await agregar(tokens.admin, orden.id, { description: 'Servicio', amount: 100, serviceTypeId: valor });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toContain('serviceTypeId');
    expect((await pool.query('SELECT COUNT(*) AS total FROM order_services'))[0][0].total).toBe(0);
  });

  test('un tipo desactivado se rechaza en una línea nueva con 400', async () => {
    const { orden, tokens } = await escenarioOrden();
    const tipo = await createServiceType({ active: false });

    const res = await agregar(tokens.admin, orden.id, { description: 'Servicio', amount: 100, serviceTypeId: tipo.id });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain('serviceTypeId');
  });

  test('PUT cambia el tipo de una línea, y editarla sin serviceTypeId no le quita el que ya tenía', async () => {
    const { orden, tokens } = await escenarioOrden();
    const aceite = await createServiceType({ name: 'Aceite' });
    const frenos = await createServiceType({ name: 'Frenos' });
    const linea = (await agregar(tokens.admin, orden.id, { description: 'Servicio', amount: 100, serviceTypeId: aceite.id })).body.data.services[0];

    const cambiada = await editar(tokens.admin, orden.id, linea.id, { description: 'Servicio', amount: 100, serviceTypeId: frenos.id });
    expect(cambiada.body.data.services[0].serviceTypeId).toBe(frenos.id);

    const sinCampo = await editar(tokens.admin, orden.id, linea.id, { description: 'Otro texto', amount: 150 });
    expect(sinCampo.status).toBe(200);
    expect(sinCampo.body.data.services[0]).toMatchObject({ description: 'Otro texto', serviceTypeId: frenos.id });
  });

  test('PUT con serviceTypeId null quita el tipo', async () => {
    const { orden, tokens } = await escenarioOrden();
    const tipo = await createServiceType();
    const linea = (await agregar(tokens.admin, orden.id, { description: 'Servicio', amount: 100, serviceTypeId: tipo.id })).body.data.services[0];

    const res = await editar(tokens.admin, orden.id, linea.id, { description: 'Servicio', amount: 100, serviceTypeId: null });

    expect(res.body.data.services[0].serviceTypeId).toBeNull();
    expect((await lineaEnBase(linea.id)).service_type_id).toBeNull();
  });

  test('PUT conserva una línea que ya usaba un tipo desactivado cuando no se cambia el tipo', async () => {
    const { orden, tokens } = await escenarioOrden();
    const tipo = await createServiceType();
    const linea = (await agregar(tokens.admin, orden.id, { description: 'Servicio', amount: 100, serviceTypeId: tipo.id })).body.data.services[0];
    await pool.query('UPDATE service_types SET active = 0 WHERE id = ?', [tipo.id]);

    const res = await editar(tokens.admin, orden.id, linea.id, { description: 'Servicio corregido', amount: 120 });

    expect(res.status).toBe(200);
    expect(res.body.data.services[0]).toMatchObject({ serviceTypeId: tipo.id, serviceTypeName: tipo.name });
  });

  test('PUT rechaza cambiar una línea a un tipo desactivado', async () => {
    const { orden, tokens } = await escenarioOrden();
    const activo = await createServiceType({ name: 'Activo' });
    const inactivo = await createServiceType({ name: 'Inactivo', active: false });
    const linea = (await agregar(tokens.admin, orden.id, { description: 'Servicio', amount: 100, serviceTypeId: activo.id })).body.data.services[0];

    const res = await editar(tokens.admin, orden.id, linea.id, { description: 'Servicio', amount: 100, serviceTypeId: inactivo.id });

    expect(res.status).toBe(400);
  });

  test('las líneas de mano de obra no aceptan tipo: se rechaza con 400', async () => {
    const { orden, tokens } = await escenarioOrden();
    const tipo = await createServiceType();

    const res = await agregar(tokens.admin, orden.id, { description: 'Mano de obra', amount: 300, serviceTypeId: tipo.id }, 'labor');

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain('serviceTypeId');
    expect((await pool.query('SELECT COUNT(*) AS total FROM order_labor'))[0][0].total).toBe(0);
  });

  test('la mano de obra sin tipo sigue funcionando y no devuelve serviceTypeId', async () => {
    const { orden, tokens } = await escenarioOrden();
    const res = await agregar(tokens.admin, orden.id, { description: 'Mano de obra', amount: 300 }, 'labor');
    expect(res.status).toBe(201);
    expect(res.body.data.labor[0]).toEqual({ id: expect.any(Number), description: 'Mano de obra', amount: 300 });
  });

  test('las líneas que existían antes del sprint siguen con tipo nulo', async () => {
    const { orden, tokens } = await escenarioOrden();
    await pool.query('INSERT INTO order_services (order_id, description, cost) VALUES (?, ?, ?)', [orden.id, 'Servicio antiguo', 250]);

    const res = await request(app).get(`/api/orders/${orden.id}`).set(bearer(tokens.admin));

    expect(res.body.data.services[0]).toMatchObject({ description: 'Servicio antiguo', amount: 250, serviceTypeId: null, serviceTypeName: null });
  });

  test('el total de la orden no cambia por usar un tipo', async () => {
    const { orden, tokens } = await escenarioOrden();
    const tipo = await createServiceType();
    const conTipo = await agregar(tokens.admin, orden.id, { description: 'Servicio', amount: 400, serviceTypeId: tipo.id });
    expect(Number(conTipo.body.data.total)).toBe(400);
  });
});
