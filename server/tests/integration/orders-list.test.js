import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createClient, createVehicle, createMechanic, createOrder } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

const listar = (token, query = '') => request(app).get(`/api/orders${query}`).set(bearer(token));

// Dos mecánicos con una orden cada uno, más una orden entregada del primero.
async function escenario() {
  const mecanicoA = await createMechanic({ username: 'mecanico.a', name: 'Mecánico A' });
  const mecanicoB = await createMechanic({ username: 'mecanico.b', name: 'Mecánico B' });
  const ana = await createClient({ name: 'Ana Pérez', phone: '5511111111' });
  const luis = await createClient({ name: 'Luis Gómez', phone: '5522222222' });
  const v1 = await createVehicle({ clientId: ana.id, licensePlate: 'AAA111' });
  const v2 = await createVehicle({ clientId: luis.id, licensePlate: 'BBB222' });
  const v3 = await createVehicle({ clientId: ana.id, licensePlate: 'CCC333' });
  const ordenA = await createOrder({ clientId: ana.id, vehicleId: v1.id, mechanicId: mecanicoA.id, status: 'EN_REPARACION' });
  const ordenB = await createOrder({ clientId: luis.id, vehicleId: v2.id, mechanicId: mecanicoB.id, status: 'RECIBIDO' });
  const ordenC = await createOrder({ clientId: ana.id, vehicleId: v3.id, mechanicId: mecanicoA.id, status: 'ENTREGADO' });
  return { mecanicoA, mecanicoB, ana, luis, ordenA, ordenB, ordenC };
}

async function sesionDe(mecanico) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ identifier: mecanico.username, password: mecanico.password });
  return res.body.data.token;
}

describe('órdenes: consulta por rol', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('el mecánico solo ve las órdenes que tiene asignadas', async () => {
    const { mecanicoA, mecanicoB, ordenA, ordenC } = await escenario();
    const resA = await listar(await sesionDe(mecanicoA));
    expect(resA.body.data.map((o) => o.folio).sort()).toEqual([ordenA.folio, ordenC.folio].sort());

    const resB = await listar(await sesionDe(mecanicoB));
    expect(resB.body.data).toHaveLength(1);
    expect(resB.body.data[0].mechanicName).toBe('Mecánico B');
  });

  test('el mecánico no puede ver órdenes ajenas aunque envíe mechanicId de otro', async () => {
    const { mecanicoA, mecanicoB } = await escenario();
    const res = await listar(await sesionDe(mecanicoA), `?mechanicId=${mecanicoB.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((o) => o.mechanicId === mecanicoA.id)).toBe(true);
    expect(res.body.meta.total).toBe(2);
  });

  test('el mecánico recibe 403 al abrir una orden ajena y 200 al abrir la suya', async () => {
    const { mecanicoA, ordenA, ordenB } = await escenario();
    const token = await sesionDe(mecanicoA);
    expect((await request(app).get(`/api/orders/${ordenB.id}`).set(bearer(token))).status).toBe(403);
    expect((await request(app).get(`/api/orders/${ordenA.id}`).set(bearer(token))).status).toBe(200);
  });

  test('administración y recepción ven todas las órdenes', async () => {
    await escenario();
    for (const rol of ['ADMIN', 'RECEPTIONIST']) {
      const { token } = await loginAs(rol);
      const res = await listar(token);
      expect(res.body.meta.total).toBe(3);
    }
  });

  test('filtra por estado, mecánico y cliente', async () => {
    const { mecanicoB, ana } = await escenario();
    const { token } = await loginAs('RECEPTIONIST');

    const porEstado = await listar(token, '?status=RECIBIDO');
    expect(porEstado.body.data.map((o) => o.status)).toEqual(['RECIBIDO']);

    const porMecanico = await listar(token, `?mechanicId=${mecanicoB.id}`);
    expect(porMecanico.body.data.map((o) => o.mechanicName)).toEqual(['Mecánico B']);

    const porCliente = await listar(token, `?clientId=${ana.id}`);
    expect(porCliente.body.meta.total).toBe(2);
  });

  test('busca por folio, placa y nombre del cliente', async () => {
    const { ordenA } = await escenario();
    const { token } = await loginAs('RECEPTIONIST');

    const porFolio = await listar(token, `?search=${ordenA.folio}`);
    expect(porFolio.body.data.map((o) => o.folio)).toEqual([ordenA.folio]);

    const porPlaca = await listar(token, '?search=bbb');
    expect(porPlaca.body.data.map((o) => o.clientName)).toEqual(['Luis Gómez']);

    const porCliente = await listar(token, '?search=g%C3%B3mez');
    expect(porCliente.body.data.map((o) => o.clientName)).toEqual(['Luis Gómez']);
  });

  test('trata los comodines de SQL de la búsqueda como texto literal', async () => {
    await escenario();
    const { token } = await loginAs('RECEPTIONIST');
    expect((await listar(token, '?search=%25')).body.data).toHaveLength(0);
    expect((await listar(token, '?search=_')).body.data).toHaveLength(0);
  });

  test('pagina y ordena de la más reciente a la más antigua', async () => {
    const mecanico = await createMechanic();
    const client = await createClient();
    const folios = [];
    for (let i = 0; i < 5; i++) {
      const vehicle = await createVehicle({ clientId: client.id, licensePlate: `PAG000${i}` });
      const orden = await createOrder({ clientId: client.id, vehicleId: vehicle.id, mechanicId: mecanico.id });
      folios.push(orden.folio);
      // Fechas distintas para que el orden sea determinista.
      await pool.query('UPDATE service_orders SET created_at = ? WHERE id = ?', [
        new Date(Date.now() - (5 - i) * 60000),
        orden.id
      ]);
    }
    const { token } = await loginAs('RECEPTIONIST');

    const pagina1 = await listar(token, '?pageSize=2&page=1');
    expect(pagina1.body.meta).toEqual({ page: 1, pageSize: 2, total: 5 });
    expect(pagina1.body.data.map((o) => o.folio)).toEqual([folios[4], folios[3]]);

    const pagina3 = await listar(token, '?pageSize=2&page=3');
    expect(pagina3.body.data.map((o) => o.folio)).toEqual([folios[0]]);
  });

  test('rechaza parámetros inválidos', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    expect((await listar(token, '?pageSize=500')).status).toBe(400);
    expect((await listar(token, '?page=0')).status).toBe(400);
    expect((await listar(token, '?status=INVENTADO')).status).toBe(400);
    expect((await listar(token, '?mechanicId=abc')).status).toBe(400);
    expect((await listar(token, `?search=${'x'.repeat(101)}`)).status).toBe(400);
  });

  test('el total de cada orden suma sus servicios y su mano de obra', async () => {
    const { ordenA } = await escenario();
    await pool.query('INSERT INTO order_services (order_id, description, cost) VALUES (?, ?, ?)', [ordenA.id, 'Cambio de balatas', 1200.5]);
    await pool.query('INSERT INTO order_labor (order_id, description, amount) VALUES (?, ?, ?)', [ordenA.id, 'Mano de obra', 350.25]);
    const { token } = await loginAs('RECEPTIONIST');
    const res = await listar(token, `?search=${ordenA.folio}`);
    expect(res.body.data[0].total).toBe(1550.75);
  });

  test('una orden inexistente responde 404, un identificador inválido 400 y sin token 401', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    expect((await request(app).get('/api/orders/9999').set(bearer(token))).status).toBe(404);
    expect((await request(app).get('/api/orders/abc').set(bearer(token))).status).toBe(400);
    expect((await request(app).get('/api/orders')).status).toBe(401);
  });
});
