import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';

const cambiar = (token, orderId, body) => request(app).post(`/api/orders/${orderId}/status`).set(bearer(token)).send(body);

describe('contrato de POST /api/orders/{id}/status', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('200 con el OrderDetail, el historial y las transiciones permitidas', async () => {
    const { orden, tokens } = await escenarioOrden('DIAGNOSTICO');
    const res = await cambiar(tokens.mecanico, orden.id, { status: 'EN_REPARACION' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: orden.id,
      status: 'EN_REPARACION',
      history: [
        { fromStatus: null, toStatus: 'DIAGNOSTICO', changedBy: expect.any(String), reason: null, changedAt: expect.any(String) },
        {
          fromStatus: 'DIAGNOSTICO',
          toStatus: 'EN_REPARACION',
          changedBy: 'Mecánico Asignado',
          reason: null,
          changedAt: expect.any(String)
        }
      ]
    });
    expect(res.body.data.allowedTransitions.sort()).toEqual(['ESPERANDO_REFACCION', 'TERMINADO']);
  });

  test('las transiciones permitidas dependen de quién consulta', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const comoMecanico = await request(app).get(`/api/orders/${orden.id}`).set(bearer(tokens.mecanico));
    const comoRecepcion = await request(app).get(`/api/orders/${orden.id}`).set(bearer(tokens.recepcion));
    expect(comoMecanico.body.data.allowedTransitions.sort()).toEqual(['ESPERANDO_REFACCION', 'TERMINADO']);
    expect(comoRecepcion.body.data.allowedTransitions.sort()).toEqual(['CANCELADA', 'ESPERANDO_REFACCION', 'TERMINADO']);
  });

  test('409 INVALID_TRANSITION con los estados permitidos en el mensaje', async () => {
    const { orden, tokens } = await escenarioOrden('DIAGNOSTICO');
    const res = await cambiar(tokens.mecanico, orden.id, { status: 'TERMINADO' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: 'INVALID_TRANSITION', message: expect.stringContaining('EN_REPARACION') }
    });
  });

  test('403 FORBIDDEN cuando el rol no puede aplicar la transición', async () => {
    const { orden, tokens } = await escenarioOrden('TERMINADO');
    const res = await cambiar(tokens.mecanico, orden.id, { status: 'ENTREGADO' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: 'FORBIDDEN', message: expect.any(String) } });
  });

  test('400 VALIDATION_ERROR cuando falta el estado', async () => {
    const { orden, tokens } = await escenarioOrden();
    const res = await cambiar(tokens.admin, orden.id, {});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
