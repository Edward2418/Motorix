import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createClient, createVehicle } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

const valid = (clientId, overrides = {}) => ({
  clientId,
  brand: 'Nissan',
  model: 'Versa',
  year: 2020,
  licensePlate: 'ABC1234',
  ...overrides
});

const post = (token, body) => request(app).post('/api/vehicles').set(bearer(token)).send(body);

describe('vehículos', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('registra un vehículo asociado a un cliente activo', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const client = await createClient();
    const res = await post(token, valid(client.id, { vin: '1hgcm82633a004352', currentMileage: 45000 }));
    expect(res.status).toBe(201);
    expect(res.body.data.vin).toBe('1HGCM82633A004352');
    expect(res.body.data.currentMileage).toBe(45000);
    expect(res.body.data.clientId).toBe(client.id);
  });

  test('el administrador también puede registrar y el VIN es opcional', async () => {
    const { token } = await loginAs('ADMIN');
    const client = await createClient();
    const res = await post(token, valid(client.id));
    expect(res.status).toBe(201);
    expect(res.body.data.vin).toBeNull();
  });

  test('rechaza un vehículo sin propietario', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const { clientId, ...sinPropietario } = valid(1);
    const res = await post(token, sinPropietario);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain('clientId');
  });

  test('rechaza un vehículo con un propietario inexistente', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const res = await post(token, valid(9999));
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('clientId');
    expect(res.body.error.details[0].message).toBe('El propietario indicado no existe.');
  });

  test('rechaza un vehículo cuyo propietario está desactivado', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const client = await createClient({ active: false });
    const res = await post(token, valid(client.id));
    expect(res.status).toBe(409);
  });

  test('rechaza una placa repetida sin importar mayúsculas, espacios o guiones', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const client = await createClient();
    await createVehicle({ clientId: client.id, licensePlate: 'ABC1234' });
    const res = await post(token, valid(client.id, { licensePlate: ' abc-12 34 ' }));
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/placa/i);
  });

  test('rechaza un VIN repetido', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const client = await createClient();
    await createVehicle({ clientId: client.id, licensePlate: 'AAA111', vin: '1HGCM82633A004352' });
    const res = await post(token, valid(client.id, { licensePlate: 'BBB222', vin: '1HGCM82633A004352' }));
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/VIN/);
  });

  test('permite varios vehículos sin VIN', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const client = await createClient();
    expect((await post(token, valid(client.id, { licensePlate: 'AAA111' }))).status).toBe(201);
    expect((await post(token, valid(client.id, { licensePlate: 'BBB222' }))).status).toBe(201);
  });

  test('valida año, VIN, placa y datos obligatorios', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const client = await createClient();
    const anioFuturo = new Date().getFullYear() + 2;

    expect((await post(token, valid(client.id, { year: 1900 }))).status).toBe(400);
    expect((await post(token, valid(client.id, { year: anioFuturo }))).status).toBe(400);
    expect((await post(token, valid(client.id, { vin: 'CORTO' }))).status).toBe(400);
    expect((await post(token, valid(client.id, { vin: '1HGCM82633A0043IO' }))).status).toBe(400);
    expect((await post(token, valid(client.id, { licensePlate: '' }))).status).toBe(400);
    expect((await post(token, valid(client.id, { licensePlate: 'AB$%&' }))).status).toBe(400);
    expect((await post(token, valid(client.id, { brand: '' }))).status).toBe(400);
    expect((await post(token, valid(client.id, { currentMileage: -5 }))).status).toBe(400);
  });

  test('lista vehículos con búsqueda por placa o propietario y filtro por cliente', async () => {
    const { token } = await loginAs('MECHANIC');
    const ana = await createClient({ name: 'Ana Pérez' });
    const luis = await createClient({ name: 'Luis Gómez' });
    await createVehicle({ clientId: ana.id, licensePlate: 'AAA111' });
    await createVehicle({ clientId: luis.id, licensePlate: 'BBB222', brand: 'Toyota', model: 'Corolla' });

    const porPlaca = await request(app).get('/api/vehicles?search=bbb').set(bearer(token));
    expect(porPlaca.body.data.map((v) => v.licensePlate)).toEqual(['BBB222']);

    const porPropietario = await request(app).get('/api/vehicles?search=ana').set(bearer(token));
    expect(porPropietario.body.data.map((v) => v.licensePlate)).toEqual(['AAA111']);

    const porCliente = await request(app).get(`/api/vehicles?clientId=${luis.id}`).set(bearer(token));
    expect(porCliente.body.data.map((v) => v.licensePlate)).toEqual(['BBB222']);
  });

  test('el detalle del cliente incluye el vehículo recién registrado', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const client = await createClient();
    await post(token, valid(client.id));
    const res = await request(app).get(`/api/clients/${client.id}`).set(bearer(token));
    expect(res.body.data.vehicles).toHaveLength(1);
    expect(res.body.data.vehicles[0].licensePlate).toBe('ABC1234');
    expect(res.body.data.vehicleCount).toBe(1);
  });

  test('desactiva y reactiva un vehículo', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const client = await createClient();
    const vehicle = await createVehicle({ clientId: client.id });

    const baja = await request(app).patch(`/api/vehicles/${vehicle.id}/status`).set(bearer(token)).send({ active: false });
    expect(baja.status).toBe(200);
    expect(baja.body.data.active).toBe(false);

    const lista = await request(app).get('/api/vehicles').set(bearer(token));
    expect(lista.body.data).toHaveLength(0);

    const alta = await request(app).patch(`/api/vehicles/${vehicle.id}/status`).set(bearer(token)).send({ active: true });
    expect(alta.body.data.active).toBe(true);
  });

  test('no reactiva un vehículo cuyo propietario está desactivado', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const client = await createClient({ active: false });
    const vehicle = await createVehicle({ clientId: client.id, active: false });
    const res = await request(app).patch(`/api/vehicles/${vehicle.id}/status`).set(bearer(token)).send({ active: true });
    expect(res.status).toBe(409);
  });

  test('el cambio de estado exige un valor booleano y un vehículo existente', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const client = await createClient();
    const vehicle = await createVehicle({ clientId: client.id });
    expect((await request(app).patch(`/api/vehicles/${vehicle.id}/status`).set(bearer(token)).send({})).status).toBe(400);
    expect((await request(app).patch('/api/vehicles/9999/status').set(bearer(token)).send({ active: false })).status).toBe(404);
  });

  test('el mecánico consulta pero recibe 403 al registrar o cambiar el estado', async () => {
    const { token } = await loginAs('MECHANIC');
    const client = await createClient();
    const vehicle = await createVehicle({ clientId: client.id });

    expect((await request(app).get('/api/vehicles').set(bearer(token))).status).toBe(200);
    expect((await request(app).get(`/api/vehicles/${vehicle.id}`).set(bearer(token))).status).toBe(200);
    expect((await post(token, valid(client.id, { licensePlate: 'ZZZ999' }))).status).toBe(403);
    expect(
      (await request(app).patch(`/api/vehicles/${vehicle.id}/status`).set(bearer(token)).send({ active: false })).status
    ).toBe(403);
  });

  test('un vehículo inexistente responde 404 y sin token responde 401', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    expect((await request(app).get('/api/vehicles/9999').set(bearer(token))).status).toBe(404);
    expect((await request(app).get('/api/vehicles')).status).toBe(401);
  });
});
