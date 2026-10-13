import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createClient, createVehicle, createMechanic } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';
import { formatFolio, nextFolio } from '../../services/folioService.js';

const anio = new Date().getFullYear();

describe('folios de las órdenes', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('el formato es OS-AAAA-NNNN con ceros a la izquierda', () => {
    expect(formatFolio(2026, 1)).toBe('OS-2026-0001');
    expect(formatFolio(2026, 42)).toBe('OS-2026-0042');
    expect(formatFolio(2027, 12345)).toBe('OS-2027-12345');
  });

  test('el consecutivo avanza de uno en uno dentro del año', async () => {
    const folios = [];
    for (let i = 0; i < 3; i++) {
      folios.push(await nextFolio(pool, new Date(2026, 5, 1)));
    }
    expect(folios).toEqual(['OS-2026-0001', 'OS-2026-0002', 'OS-2026-0003']);
  });

  test('el consecutivo se reinicia al cambiar de año sin afectar al anterior', async () => {
    expect(await nextFolio(pool, new Date(2025, 11, 31))).toBe('OS-2025-0001');
    expect(await nextFolio(pool, new Date(2025, 11, 31))).toBe('OS-2025-0002');
    expect(await nextFolio(pool, new Date(2026, 0, 1))).toBe('OS-2026-0001');
    expect(await nextFolio(pool, new Date(2025, 11, 31))).toBe('OS-2025-0003');
  });

  test('órdenes creadas en paralelo reciben folios consecutivos, sin huecos ni repetidos', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const mecanico = await createMechanic();
    const cantidad = 6;
    const peticiones = [];
    for (let i = 0; i < cantidad; i++) {
      const client = await createClient({ name: `Cliente ${i}`, phone: `55000000${i}0` });
      const vehicle = await createVehicle({ clientId: client.id, licensePlate: `PAR000${i}` });
      peticiones.push({ clientId: client.id, vehicleId: vehicle.id });
    }

    const respuestas = await Promise.all(
      peticiones.map((datos) =>
        request(app)
          .post('/api/orders')
          .set(bearer(token))
          .send({ ...datos, mechanicId: mecanico.id, entryMileage: 100, reportedProblem: 'Revisión' })
      )
    );

    respuestas.forEach((res) => expect(res.status).toBe(201));
    const folios = respuestas.map((res) => res.body.data.folio).sort();
    const esperados = Array.from({ length: cantidad }, (_, i) => formatFolio(anio, i + 1));
    expect(folios).toEqual(esperados);
  });

  test('una orden cancelada no libera su folio', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const mecanico = await createMechanic();
    const client = await createClient();
    const vehicle = await createVehicle({ clientId: client.id });
    const datos = { clientId: client.id, vehicleId: vehicle.id, mechanicId: mecanico.id, entryMileage: 10, reportedProblem: 'Prueba' };

    const primera = await request(app).post('/api/orders').set(bearer(token)).send(datos);
    await pool.query("UPDATE service_orders SET status = 'CANCELADA' WHERE id = ?", [primera.body.data.id]);
    const segunda = await request(app).post('/api/orders').set(bearer(token)).send(datos);

    expect(primera.body.data.folio).toBe(formatFolio(anio, 1));
    expect(segunda.body.data.folio).toBe(formatFolio(anio, 2));
  });
});
