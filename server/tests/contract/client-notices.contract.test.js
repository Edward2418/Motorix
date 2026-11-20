import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createClient, createVehicle, createMechanic, createOrder } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

// La base se limpia antes de cada prueba y la conexión se cierra una sola vez, al terminar el archivo.
beforeEach(resetTables);
afterAll(closePool);

const listar = (token) => request(app).get('/api/client-notices').set(bearer(token));
const registrar = (token, cuerpo) => request(app).post('/api/client-notices').set(bearer(token)).send(cuerpo);

// Una orden terminada sin entregar: genera el hecho ORDEN_TERMINADA.
async function ordenTerminada() {
  const mecanico = await createMechanic();
  const cliente = await createClient({ name: 'Cliente Contrato', phone: '5550001111' });
  const vehiculo = await createVehicle({ clientId: cliente.id, licensePlate: 'CON4001' });
  const orden = await createOrder({ clientId: cliente.id, vehicleId: vehiculo.id, mechanicId: mecanico.id, status: 'TERMINADO' });
  return { cliente, vehiculo, orden };
}

describe('contrato de GET /api/client-notices', () => {
  test('responde 200 con { data: [...], meta: { total } } y los campos de cada elemento', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const { cliente, orden } = await ordenTerminada();

    const res = await listar(token);

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ total: 1 });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toEqual({
      reason: 'ORDEN_TERMINADA',
      factKey: `ORDER:${orden.id}`,
      clientId: cliente.id,
      clientName: 'Cliente Contrato',
      phone: '5550001111',
      vehicleLabel: expect.stringContaining('CON4001'),
      detail: expect.stringContaining(orden.folio),
      date: expect.any(String)
    });
  });

  test('sin hechos pendientes responde { data: [], meta: { total: 0 } }', async () => {
    const { token } = await loginAs('ADMIN');
    const res = await listar(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], meta: { total: 0 } });
  });

  test('sin token responde 401', async () => {
    expect((await request(app).get('/api/client-notices')).status).toBe(401);
  });

  test('el mecánico responde 403', async () => {
    const { token } = await loginAs('MECHANIC');
    expect((await listar(token)).status).toBe(403);
  });
});

describe('contrato de POST /api/client-notices', () => {
  test('responde 201 con el aviso registrado', async () => {
    const { token, user } = await loginAs('RECEPTIONIST');
    const { cliente, orden } = await ordenTerminada();

    const res = await registrar(token, { reason: 'ORDEN_TERMINADA', factKey: `ORDER:${orden.id}`, note: 'No contestó' });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({
      id: expect.any(Number),
      reason: 'ORDEN_TERMINADA',
      factKey: `ORDER:${orden.id}`,
      clientId: cliente.id,
      note: 'No contestó',
      notifiedBy: user.id,
      notifiedByName: expect.any(String),
      notifiedAt: expect.any(String)
    });
  });

  test('la nota es opcional y queda en null', async () => {
    const { token } = await loginAs('ADMIN');
    const { orden } = await ordenTerminada();

    const res = await registrar(token, { reason: 'ORDEN_TERMINADA', factKey: `ORDER:${orden.id}` });

    expect(res.status).toBe(201);
    expect(res.body.data.note).toBeNull();
  });

  test.each([
    ['un factKey sin el formato TIPO:id', { reason: 'ORDEN_TERMINADA', factKey: 'cualquier cosa' }, 'factKey'],
    ['un prefijo desconocido', { reason: 'ORDEN_TERMINADA', factKey: 'STOCK:3' }, 'factKey'],
    ['un factKey de más de 60 caracteres', { reason: 'ORDEN_TERMINADA', factKey: `ORDER:${'9'.repeat(60)}` }, 'factKey'],
    ['un reason fuera del ENUM', { reason: 'OTRO_MOTIVO', factKey: 'ORDER:1' }, 'reason'],
    ['un cuerpo sin reason', { factKey: 'ORDER:1' }, 'reason'],
    ['una nota de más de 255 caracteres', { reason: 'ORDEN_TERMINADA', factKey: 'ORDER:1', note: 'x'.repeat(256) }, 'note']
  ])('responde 400 VALIDATION_ERROR con %s', async (_nombre, cuerpo, campo) => {
    const { token } = await loginAs('ADMIN');

    const res = await registrar(token, cuerpo);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toContain(campo);
  });

  test('una nota de exactamente 255 caracteres es válida', async () => {
    const { token } = await loginAs('ADMIN');
    const { orden } = await ordenTerminada();
    const res = await registrar(token, { reason: 'ORDEN_TERMINADA', factKey: `ORDER:${orden.id}`, note: 'x'.repeat(255) });
    expect(res.status).toBe(201);
  });

  test('sin token responde 401', async () => {
    const res = await request(app).post('/api/client-notices').send({ reason: 'ORDEN_TERMINADA', factKey: 'ORDER:1' });
    expect(res.status).toBe(401);
  });

  test('el mecánico responde 403', async () => {
    const { token } = await loginAs('MECHANIC');
    expect((await registrar(token, { reason: 'ORDEN_TERMINADA', factKey: 'ORDER:1' })).status).toBe(403);
  });
});
