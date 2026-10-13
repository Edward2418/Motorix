import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createClient, createVehicle, createOrder } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';

// Se prueban igual servicios y mano de obra: cambia la ruta, no el comportamiento.
const TIPOS = ['services', 'labor'];

const agregar = (token, orderId, tipo, body) =>
  request(app).post(`/api/orders/${orderId}/${tipo}`).set(bearer(token)).send(body);
const editar = (token, orderId, tipo, lineId, body) =>
  request(app).put(`/api/orders/${orderId}/${tipo}/${lineId}`).set(bearer(token)).send(body);
const quitar = (token, orderId, tipo, lineId) =>
  request(app).delete(`/api/orders/${orderId}/${tipo}/${lineId}`).set(bearer(token));

describe('órdenes: servicios y mano de obra', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  for (const tipo of TIPOS) {
    describe(tipo === 'services' ? 'servicios realizados' : 'mano de obra', () => {
      test('alta, edición y borrado de líneas', async () => {
        const { orden, tokens } = await escenarioOrden();
        const alta = await agregar(tokens.mecanico, orden.id, tipo, { description: '  Cambio de balatas ', amount: 1200 });
        expect(alta.status).toBe(201);
        expect(alta.body.data[tipo][0].description).toBe('Cambio de balatas');

        const lineId = alta.body.data[tipo][0].id;
        const edicion = await editar(tokens.mecanico, orden.id, tipo, lineId, { description: 'Cambio de balatas y discos', amount: 2500.5 });
        expect(edicion.status).toBe(200);
        expect(edicion.body.data[tipo]).toEqual([{ id: lineId, description: 'Cambio de balatas y discos', amount: 2500.5 }]);

        const baja = await quitar(tokens.mecanico, orden.id, tipo, lineId);
        expect(baja.status).toBe(200);
        expect(baja.body.data[tipo]).toEqual([]);
      });

      test('la descripción es obligatoria y admite hasta 255 caracteres', async () => {
        const { orden, tokens } = await escenarioOrden();
        expect((await agregar(tokens.mecanico, orden.id, tipo, { description: '', amount: 10 })).status).toBe(400);
        expect((await agregar(tokens.mecanico, orden.id, tipo, { description: 'x'.repeat(256), amount: 10 })).status).toBe(400);
        expect((await agregar(tokens.mecanico, orden.id, tipo, { description: 'x'.repeat(255), amount: 10 })).status).toBe(201);
      });

      test('el importe debe ser un número entre 0 y 99,999,999.99 con máximo dos decimales', async () => {
        const { orden, tokens } = await escenarioOrden();
        for (const invalido of [-1, '100', null, undefined, 10.123, 100000000, Number.NaN]) {
          const res = await agregar(tokens.mecanico, orden.id, tipo, { description: 'Prueba', amount: invalido });
          expect({ valor: String(invalido), status: res.status }).toEqual({ valor: String(invalido), status: 400 });
          expect(res.body.error.details.map((d) => d.field)).toContain('amount');
        }
        for (const valido of [0, 0.01, 99999999.99, 10.5]) {
          expect((await agregar(tokens.mecanico, orden.id, tipo, { description: 'Prueba', amount: valido })).status).toBe(201);
        }
      });

      test('permisos: mecánico asignado y administrador sí; otro mecánico y recepción 403', async () => {
        const { orden, tokens } = await escenarioOrden();
        const cuerpo = { description: 'Prueba', amount: 10 };
        expect((await agregar(tokens.mecanico, orden.id, tipo, cuerpo)).status).toBe(201);
        expect((await agregar(tokens.admin, orden.id, tipo, cuerpo)).status).toBe(201);
        expect((await agregar(tokens.otro, orden.id, tipo, cuerpo)).status).toBe(403);
        expect((await agregar(tokens.recepcion, orden.id, tipo, cuerpo)).status).toBe(403);

        const lineId = (await agregar(tokens.mecanico, orden.id, tipo, cuerpo)).body.data[tipo][0].id;
        for (const quien of ['otro', 'recepcion']) {
          expect((await editar(tokens[quien], orden.id, tipo, lineId, cuerpo)).status).toBe(403);
          expect((await quitar(tokens[quien], orden.id, tipo, lineId)).status).toBe(403);
        }
      });

      test('en TERMINADO, ENTREGADO y CANCELADA no se pueden agregar, editar ni quitar líneas (409)', async () => {
        for (const estado of ['TERMINADO', 'ENTREGADO', 'CANCELADA']) {
          await resetTables();
          const { orden, tokens } = await escenarioOrden('EN_REPARACION');
          const lineId = (await agregar(tokens.mecanico, orden.id, tipo, { description: 'Previa', amount: 5 })).body.data[tipo][0].id;
          await pool.query('UPDATE service_orders SET status = ? WHERE id = ?', [estado, orden.id]);

          const cuerpo = { description: 'Tarde', amount: 10 };
          expect({ estado, status: (await agregar(tokens.mecanico, orden.id, tipo, cuerpo)).status }).toEqual({ estado, status: 409 });
          expect((await editar(tokens.admin, orden.id, tipo, lineId, cuerpo)).status).toBe(409);
          expect((await quitar(tokens.mecanico, orden.id, tipo, lineId)).status).toBe(409);
        }
      });

      test('una línea de otra orden responde 404 y no se modifica', async () => {
        const { orden, tokens, mecanico, client } = await escenarioOrden();
        const otroVehiculo = await createVehicle({ clientId: client.id, licensePlate: 'OTR0001' });
        const otraOrden = await createOrder({
          clientId: client.id,
          vehicleId: otroVehiculo.id,
          mechanicId: mecanico.id,
          status: 'DIAGNOSTICO'
        });
        const ajena = (await agregar(tokens.mecanico, otraOrden.id, tipo, { description: 'Ajena', amount: 50 })).body.data[tipo][0].id;

        expect((await editar(tokens.mecanico, orden.id, tipo, ajena, { description: 'Robada', amount: 1 })).status).toBe(404);
        expect((await quitar(tokens.mecanico, orden.id, tipo, ajena)).status).toBe(404);
        const detalle = await request(app).get(`/api/orders/${otraOrden.id}`).set(bearer(tokens.admin));
        expect(detalle.body.data[tipo][0].description).toBe('Ajena');
      });

      test('una orden inexistente responde 404 y sin token 401', async () => {
        const { tokens } = await escenarioOrden();
        expect((await agregar(tokens.admin, 9999, tipo, { description: 'x', amount: 1 })).status).toBe(404);
        expect((await request(app).post(`/api/orders/1/${tipo}`).send({ description: 'x', amount: 1 })).status).toBe(401);
      });
    });
  }

  test('el total es la suma de servicios y mano de obra, sin errores de decimales', async () => {
    const { orden, tokens } = await escenarioOrden();
    await agregar(tokens.mecanico, orden.id, 'services', { description: 'Uno', amount: 0.1 });
    await agregar(tokens.mecanico, orden.id, 'services', { description: 'Dos', amount: 0.2 });
    const res = await agregar(tokens.mecanico, orden.id, 'labor', { description: 'Mano de obra', amount: 350.35 });

    expect(res.body.data.servicesTotal).toBe(0.3);
    expect(res.body.data.laborTotal).toBe(350.35);
    expect(res.body.data.total).toBe(350.65);
  });

  test('el total se recalcula al editar y quitar líneas', async () => {
    const { orden, tokens } = await escenarioOrden();
    const a = (await agregar(tokens.mecanico, orden.id, 'services', { description: 'A', amount: 100 })).body.data.services[0].id;
    await agregar(tokens.mecanico, orden.id, 'labor', { description: 'B', amount: 50 });

    const editada = await editar(tokens.mecanico, orden.id, 'services', a, { description: 'A', amount: 300 });
    expect(editada.body.data.total).toBe(350);

    const quitada = await quitar(tokens.mecanico, orden.id, 'services', a);
    expect(quitada.body.data.total).toBe(50);
  });

  test('las líneas y el total aparecen en el listado y en el detalle', async () => {
    const { orden, tokens } = await escenarioOrden();
    await agregar(tokens.mecanico, orden.id, 'services', { description: 'Cambio de aceite', amount: 800 });
    const lista = await request(app).get('/api/orders').set(bearer(tokens.admin));
    expect(lista.body.data[0].total).toBe(800);
    const detalle = await request(app).get(`/api/orders/${orden.id}`).set(bearer(tokens.mecanico));
    expect(detalle.body.data.services).toHaveLength(1);
  });
});
