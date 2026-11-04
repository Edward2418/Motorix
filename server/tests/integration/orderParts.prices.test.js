import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createPart, createVehicle, createOrder, addServiceLine } from '../helpers/db.js';
import { bearer, loginAs } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';
import { runSeeds } from '../../scripts/sqlRunner.js';

afterAll(closePool);

const agregar = (token, orderId, body) => request(app).post(`/api/orders/${orderId}/parts`).set(bearer(token)).send(body);
const cambiar = (token, orderId, lineId, body) => request(app).put(`/api/orders/${orderId}/parts/${lineId}`).set(bearer(token)).send(body);
const cambiarPrecio = (token, partId, salePrice) => request(app).put(`/api/parts/${partId}`).set(bearer(token)).send({ salePrice });
const detalle = (token, orderId) => request(app).get(`/api/orders/${orderId}`).set(bearer(token));
const preciosGuardados = async (orderId) =>
  (await pool.query('SELECT unit_price FROM order_parts WHERE order_id = ? ORDER BY id', [orderId]))[0].map((fila) => Number(fila.unit_price));

describe('instantánea del precio de la línea de una orden', () => {
  beforeEach(resetTables);

  test('un cambio posterior del precio de venta no altera la línea, su importe ni el total, y una orden nueva toma el precio nuevo', async () => {
    const { orden, client, mecanico, tokens } = await escenarioOrden('EN_REPARACION');
    await addServiceLine(orden.id, 'Afinación', 500);
    const pieza = await createPart({ code: 'FIL-ACE', stock: 20, purchasePrice: 100, salePrice: 180 });
    expect((await agregar(tokens.mecanico, orden.id, { partId: pieza.id, quantity: 2 })).status).toBe(201);
    const antes = (await detalle(tokens.admin, orden.id)).body.data;
    expect(antes.parts[0]).toMatchObject({ unitPrice: 180, subtotal: 360 });
    expect(antes.total).toBe(860);

    const cambio = await cambiarPrecio(tokens.admin, pieza.id, 250);
    expect(cambio.status).toBe(200);

    const despues = (await detalle(tokens.admin, orden.id)).body.data;
    expect(despues.parts[0]).toMatchObject({ unitPrice: 180, subtotal: 360 });
    expect(despues.partsTotal).toBe(antes.partsTotal);
    expect(despues.total).toBe(antes.total);

    // Una orden nueva (de otro vehículo) toma el precio vigente.
    const otroVehiculo = await createVehicle({ clientId: client.id, licensePlate: 'XYZ9876' });
    const nueva = await createOrder({ clientId: client.id, vehicleId: otroVehiculo.id, mechanicId: mecanico.id, status: 'EN_REPARACION' });
    expect((await agregar(tokens.mecanico, nueva.id, { partId: pieza.id, quantity: 1 })).status).toBe(201);
    expect(await preciosGuardados(nueva.id)).toEqual([250]);
    expect(await preciosGuardados(orden.id)).toEqual([180]);
  });

  test('la línea no tiene una acción para cambiar su precio: enviar unitPrice al cambiar la cantidad nunca lo modifica', async () => {
    const { orden, tokens } = await escenarioOrden('EN_REPARACION');
    const pieza = await createPart({ code: 'FIL-ACE', stock: 20, purchasePrice: 100, salePrice: 180 });
    const agregada = await agregar(tokens.mecanico, orden.id, { partId: pieza.id, quantity: 2 });
    const lineId = agregada.body.data.parts[0].id;

    const res = await cambiar(tokens.mecanico, orden.id, lineId, { quantity: 3, unitPrice: 1 });
    // Se ignora el campo (200) o se rechaza por desconocido (400); en ambos casos el precio de la línea no cambia.
    expect([200, 400]).toContain(res.status);
    expect(await preciosGuardados(orden.id)).toEqual([180]);

    const sinCantidad = await cambiar(tokens.admin, orden.id, lineId, { unitPrice: 1 });
    expect([200, 400]).toContain(sinCantidad.status);
    expect(await preciosGuardados(orden.id)).toEqual([180]);
  });
});

describe('cambiar el precio de todas las refacciones no toca lo ya emitido', () => {
  beforeEach(async () => {
    await resetTables();
    await runSeeds(pool, () => {});
  });

  test('los pagos y los tickets sembrados conservan su importe y su contenido', async () => {
    // Los seeds ya traen el usuario `admin`: se crea otro administrador para la sesión de la prueba.
    const { token } = await loginAs('ADMIN', { username: 'admin.pruebas' });
    const pagos = async () => (await pool.query('SELECT id, order_id, amount, method, status FROM payments ORDER BY id'))[0];
    const tickets = async () => (await pool.query('SELECT id, folio, order_id, order_total FROM tickets ORDER BY id'))[0];
    const contenidos = async () => {
      const ordenes = (await tickets()).map((ticket) => ticket.order_id);
      const respuestas = [];
      for (const orderId of ordenes) {
        respuestas.push((await request(app).get(`/api/orders/${orderId}/ticket`).set(bearer(token))).body.data);
      }
      return respuestas;
    };

    const pagosAntes = await pagos();
    const ticketsAntes = await tickets();
    const contenidosAntes = await contenidos();
    const lineasAntes = (await pool.query('SELECT id, unit_price FROM order_parts ORDER BY id'))[0];
    expect(pagosAntes.length).toBeGreaterThan(0);
    expect(contenidosAntes.length).toBeGreaterThan(0);

    const [piezas] = await pool.query('SELECT id FROM parts ORDER BY id');
    for (const pieza of piezas) {
      // Precio muy superior al de compra de cualquier pieza de ejemplo: no pide confirmación por venta bajo el costo.
      expect((await cambiarPrecio(token, pieza.id, 99999)).status).toBe(200);
    }

    expect(await pagos()).toEqual(pagosAntes);
    expect(await tickets()).toEqual(ticketsAntes);
    expect(await contenidos()).toEqual(contenidosAntes);
    expect((await pool.query('SELECT id, unit_price FROM order_parts ORDER BY id'))[0]).toEqual(lineasAntes);
  });
});
