import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createClient, createVehicle, createMechanic, createOrder, createPart } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';
import { tokenDe } from '../helpers/orders.js';

afterAll(closePool);

const agregar = (token, orderId, body) => request(app).post(`/api/orders/${orderId}/parts`).set(bearer(token)).send(body);

const stockDe = async (partId) => (await pool.query('SELECT stock FROM parts WHERE id = ?', [partId]))[0][0].stock;
const sumaDe = async (partId) =>
  Number((await pool.query('SELECT COALESCE(SUM(quantity), 0) AS total FROM inventory_movements WHERE part_id = ?', [partId]))[0][0].total);

// Prepara varias órdenes abiertas (una por vehículo) asignadas al mismo mecánico.
async function ordenes(cantidad) {
  const mecanico = await createMechanic({ username: 'mecanico.concurrente' });
  const token = await tokenDe(mecanico);
  const cliente = await createClient();
  const lista = [];
  for (let i = 0; i < cantidad; i += 1) {
    const vehiculo = await createVehicle({ clientId: cliente.id, licensePlate: `CON${1000 + i}` });
    lista.push(await createOrder({ clientId: cliente.id, vehicleId: vehiculo.id, mechanicId: mecanico.id, status: 'EN_REPARACION' }));
  }
  return { token, lista };
}

describe('refacciones: concurrencia', () => {
  beforeEach(resetTables);

  test('dos solicitudes por la última unidad en órdenes distintas: una tiene éxito y la otra recibe stock insuficiente', async () => {
    await loginAs('ADMIN');
    const { token, lista } = await ordenes(2);
    const pieza = await createPart({ code: 'ULT-01', stock: 1 });

    const [a, b] = await Promise.all([
      agregar(token, lista[0].id, { partId: pieza.id, quantity: 1 }),
      agregar(token, lista[1].id, { partId: pieza.id, quantity: 1 })
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const rechazada = a.status === 409 ? a : b;
    expect(rechazada.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(await stockDe(pieza.id)).toBe(0);
    expect(await sumaDe(pieza.id)).toBe(0);
  });

  test('muchas solicitudes simultáneas nunca dejan el stock negativo y la suma de movimientos coincide', async () => {
    await loginAs('ADMIN');
    const { token, lista } = await ordenes(6);
    const pieza = await createPart({ code: 'MUC-01', stock: 4 });

    const respuestas = await Promise.all(lista.map((orden) => agregar(token, orden.id, { partId: pieza.id, quantity: 1 })));
    const exitos = respuestas.filter((r) => r.status === 201).length;
    expect(exitos).toBe(4);
    expect(respuestas.filter((r) => r.status === 409)).toHaveLength(2);
    expect(await stockDe(pieza.id)).toBe(0);
    expect(await sumaDe(pieza.id)).toBe(0);
  });

  test('solicitudes simultáneas con dos refacciones en orden inverso no producen interbloqueos', async () => {
    await loginAs('ADMIN');
    const { token, lista } = await ordenes(4);
    const a = await createPart({ code: 'PAR-A', stock: 50 });
    const b = await createPart({ code: 'PAR-B', stock: 50 });

    const trabajo = lista.flatMap((orden, i) => {
      const [primera, segunda] = i % 2 === 0 ? [a, b] : [b, a];
      return [
        agregar(token, orden.id, { partId: primera.id, quantity: 1 }),
        agregar(token, orden.id, { partId: segunda.id, quantity: 1 })
      ];
    });
    const respuestas = await Promise.all(trabajo);
    expect(respuestas.every((r) => r.status === 201)).toBe(true);
    expect(await stockDe(a.id)).toBe(46);
    expect(await stockDe(b.id)).toBe(46);
    expect(await sumaDe(a.id)).toBe(await stockDe(a.id));
    expect(await sumaDe(b.id)).toBe(await stockDe(b.id));
  });
});
