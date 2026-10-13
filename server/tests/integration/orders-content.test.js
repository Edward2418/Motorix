import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';

const editar = (token, orderId, body) => request(app).patch(`/api/orders/${orderId}`).set(bearer(token)).send(body);

const filaOrden = async (id) => (await pool.query('SELECT * FROM service_orders WHERE id = ?', [id]))[0][0];

describe('órdenes: contenido técnico', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('el mecánico asignado edita diagnóstico, observaciones y recomendaciones', async () => {
    const { orden, tokens } = await escenarioOrden();
    const res = await editar(tokens.mecanico, orden.id, {
      diagnosis: '  Balatas desgastadas  ',
      notes: 'Disco con rayaduras',
      recommendations: 'Cambiar discos en el próximo servicio'
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      diagnosis: 'Balatas desgastadas',
      notes: 'Disco con rayaduras',
      recommendations: 'Cambiar discos en el próximo servicio'
    });
    expect((await filaOrden(orden.id)).diagnosis).toBe('Balatas desgastadas');
  });

  test('el mecánico asignado no puede editar el problema reportado (403)', async () => {
    const { orden, tokens } = await escenarioOrden();
    const res = await editar(tokens.mecanico, orden.id, { reportedProblem: 'Otro problema' });
    expect(res.status).toBe(403);
    expect((await filaOrden(orden.id)).reported_problem).toBe('Ruido en el motor');
  });

  test('administración edita el contenido técnico y el problema reportado', async () => {
    const { orden, tokens } = await escenarioOrden();
    const res = await editar(tokens.admin, orden.id, {
      reportedProblem: 'Ruido y vibración',
      diagnosis: 'Diagnóstico de respaldo'
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ reportedProblem: 'Ruido y vibración', diagnosis: 'Diagnóstico de respaldo' });
  });

  test('recepción edita solo el problema reportado y no el contenido técnico (403)', async () => {
    const { orden, tokens } = await escenarioOrden();
    const bien = await editar(tokens.recepcion, orden.id, { reportedProblem: 'Ruido al frenar' });
    expect(bien.status).toBe(200);
    expect(bien.body.data.reportedProblem).toBe('Ruido al frenar');

    for (const campo of ['diagnosis', 'notes', 'recommendations']) {
      expect((await editar(tokens.recepcion, orden.id, { [campo]: 'Algo' })).status).toBe(403);
    }
  });

  test('otro mecánico recibe 403 en cualquier edición', async () => {
    const { orden, tokens } = await escenarioOrden();
    expect((await editar(tokens.otro, orden.id, { diagnosis: 'Intruso' })).status).toBe(403);
    expect((await filaOrden(orden.id)).diagnosis).toBeNull();
  });

  test('una petición mixta con un campo no permitido se rechaza completa', async () => {
    const { orden, tokens } = await escenarioOrden();
    const res = await editar(tokens.mecanico, orden.id, { diagnosis: 'Sí', reportedProblem: 'No' });
    expect(res.status).toBe(403);
    expect((await filaOrden(orden.id)).diagnosis).toBeNull();
  });

  test('los campos no enviados no se modifican y el texto vacío guarda null', async () => {
    const { orden, tokens } = await escenarioOrden();
    await editar(tokens.mecanico, orden.id, { diagnosis: 'Uno', notes: 'Dos', recommendations: 'Tres' });

    const parcial = await editar(tokens.mecanico, orden.id, { notes: 'Dos modificado' });
    expect(parcial.body.data).toMatchObject({ diagnosis: 'Uno', notes: 'Dos modificado', recommendations: 'Tres' });

    const vacio = await editar(tokens.mecanico, orden.id, { diagnosis: '   ', recommendations: null });
    expect(vacio.body.data.diagnosis).toBeNull();
    expect(vacio.body.data.recommendations).toBeNull();
    expect(vacio.body.data.notes).toBe('Dos modificado');
  });

  test('valida las longitudes máximas', async () => {
    const { orden, tokens } = await escenarioOrden();
    expect((await editar(tokens.mecanico, orden.id, { diagnosis: 'x'.repeat(4001) })).status).toBe(400);
    expect((await editar(tokens.mecanico, orden.id, { diagnosis: 'x'.repeat(4000) })).status).toBe(200);
    expect((await editar(tokens.admin, orden.id, { reportedProblem: 'x'.repeat(2001) })).status).toBe(400);
    expect((await editar(tokens.admin, orden.id, { reportedProblem: '' })).status).toBe(400);
  });

  test('una petición sin ningún campo editable se rechaza', async () => {
    const { orden, tokens } = await escenarioOrden();
    expect((await editar(tokens.mecanico, orden.id, {})).status).toBe(400);
  });

  test('en TERMINADO solo se editan observaciones y recomendaciones', async () => {
    const { orden, tokens } = await escenarioOrden('TERMINADO');
    expect((await editar(tokens.mecanico, orden.id, { notes: 'Nota final', recommendations: 'Revisar en 5,000 km' })).status).toBe(200);
    expect((await editar(tokens.mecanico, orden.id, { diagnosis: 'Tarde' })).status).toBe(409);
    expect((await editar(tokens.admin, orden.id, { reportedProblem: 'Tarde' })).status).toBe(409);
  });

  test('en ENTREGADO y CANCELADA nada se edita (409)', async () => {
    for (const estado of ['ENTREGADO', 'CANCELADA']) {
      await resetTables();
      const { orden, tokens } = await escenarioOrden(estado);
      expect((await editar(tokens.mecanico, orden.id, { notes: 'No' })).status).toBe(409);
      expect((await editar(tokens.admin, orden.id, { diagnosis: 'No' })).status).toBe(409);
      expect((await editar(tokens.recepcion, orden.id, { reportedProblem: 'No' })).status).toBe(409);
    }
  });

  test('una orden inexistente responde 404 y sin token 401', async () => {
    const { tokens } = await escenarioOrden();
    expect((await editar(tokens.admin, 9999, { notes: 'x' })).status).toBe(404);
    expect((await request(app).patch('/api/orders/1').send({ notes: 'x' })).status).toBe(401);
  });
});
