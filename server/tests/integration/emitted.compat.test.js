import request from 'supertest';
import app from '../../app.js';
import {
  pool,
  resetTables,
  closePool,
  addServiceLine,
  createTicket,
  createClient,
  createVehicle,
  createOrder
} from '../helpers/db.js';
import { bearer, loginAs } from '../helpers/auth.js';
import { escenarioPago } from '../helpers/payments.js';
import { runSeeds } from '../../scripts/sqlRunner.js';

afterAll(closePool);

const generar = (token, orderId) => request(app).post(`/api/orders/${orderId}/ticket`).set(bearer(token));
const consultar = (token, orderId) => request(app).get(`/api/orders/${orderId}/ticket`).set(bearer(token));
const contenidoDe = async (orderId) => (await pool.query('SELECT content FROM tickets WHERE order_id = ?', [orderId]))[0][0].content;
const anio = new Date().getFullYear();

describe('tickets anteriores al Sprint 5 (sin contenido guardado)', () => {
  beforeEach(resetTables);

  test('se consultan y se generan de nuevo sin errores, con su folio y armados con los datos vigentes como antes', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'TERMINADO', total: 1000 });
    const anterior = await createTicket({ orderId: orden.id, folio: `TK-${anio}-0001`, orderTotal: 1000 });
    expect(await contenidoDe(orden.id)).toBeNull();

    const consulta = await consultar(tokens.recepcion, orden.id);
    expect(consulta.status).toBe(200);
    expect(consulta.body.data).toMatchObject({ id: anterior.id, folio: `TK-${anio}-0001`, total: 1000, orderChangedSinceGenerated: false });

    // Como en el Sprint 4: un ticket anterior se arma con los datos vigentes y avisa si la orden cambió.
    await addServiceLine(orden.id, 'Mano de obra posterior', 100, 'order_labor');
    const cambiado = (await consultar(tokens.recepcion, orden.id)).body.data;
    expect(cambiado.total).toBe(1100);
    expect(cambiado.orderChangedSinceGenerated).toBe(true);

    const repetido = await generar(tokens.admin, orden.id);
    expect(repetido.status).toBe(200);
    expect(repetido.body.data.id).toBe(anterior.id);
    expect(repetido.body.data.folio).toBe(`TK-${anio}-0001`);
    // No se congela al consultarlo ni al generarlo de nuevo.
    expect(await contenidoDe(orden.id)).toBeNull();
    expect((await pool.query('SELECT COUNT(*) AS total FROM tickets'))[0][0].total).toBe(1);
  });

  test('conviven con un ticket nuevo: el anterior sin contenido y el nuevo con contenido guardado', async () => {
    const vieja = await escenarioPago({ status: 'TERMINADO', total: 1000 });
    const anterior = await createTicket({ orderId: vieja.orden.id, folio: `TK-${anio}-0001`, orderTotal: 1000 });

    // Otra orden (de otro vehículo) con un ticket emitido ahora.
    const client = await createClient({ name: 'Luis Gómez', phone: '5559998888' });
    const vehicle = await createVehicle({ clientId: client.id, licensePlate: 'NUE1234' });
    const nuevaOrden = await createOrder({ clientId: client.id, vehicleId: vehicle.id, mechanicId: vieja.mecanico.id, status: 'TERMINADO' });
    await addServiceLine(nuevaOrden.id, 'Servicio nuevo', 600);
    await pool.query('INSERT INTO ticket_folio_counters (year, last_number) VALUES (?, 1) ON DUPLICATE KEY UPDATE last_number = 1', [anio]);

    const creado = await generar(vieja.tokens.recepcion, nuevaOrden.id);
    expect(creado.status).toBe(201);
    expect(creado.body.data.folio).toBe(`TK-${anio}-0002`);
    expect(await contenidoDe(vieja.orden.id)).toBeNull();
    expect(await contenidoDe(nuevaOrden.id)).not.toBeNull();

    expect((await consultar(vieja.tokens.recepcion, vieja.orden.id)).body.data.id).toBe(anterior.id);
    expect((await consultar(vieja.tokens.recepcion, nuevaOrden.id)).body.data.id).toBe(creado.body.data.id);
  });
});

describe('pagos y tickets sembrados (seeds 008 y 009)', () => {
  beforeEach(async () => {
    await resetTables();
    await runSeeds(pool, () => {});
  });

  test('siguen consultándose, no tienen contenido guardado y generarlos de nuevo no lo congela', async () => {
    const { token } = await loginAs('ADMIN', { username: 'admin.pruebas' });
    // Solo los tickets de los seeds 009 (anteriores al Sprint 5); el del seed 010 ya trae su contenido guardado.
    const [tickets] = await pool.query("SELECT id, folio, order_id FROM tickets WHERE folio IN ('TK-2026-0001', 'TK-2026-0002') ORDER BY id");
    expect(tickets).toHaveLength(2);

    const pagosAntes = (await pool.query('SELECT id, amount, status FROM payments ORDER BY id'))[0];
    for (const ticket of tickets) {
      const consulta = await consultar(token, ticket.order_id);
      expect(consulta.status).toBe(200);
      expect(consulta.body.data.folio).toBe(ticket.folio);

      const repetido = await generar(token, ticket.order_id);
      expect(repetido.status).toBe(200);
      expect(repetido.body.data.folio).toBe(ticket.folio);
      expect(await contenidoDe(ticket.order_id)).toBeNull();
    }
    expect((await pool.query('SELECT id, amount, status FROM payments ORDER BY id'))[0]).toEqual(pagosAntes);
  });
});
