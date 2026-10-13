import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createClient } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

const post = (token, body) => request(app).post('/api/clients').set(bearer(token)).send(body);
const put = (token, id, body) => request(app).put(`/api/clients/${id}`).set(bearer(token)).send(body);

describe('clientes: aviso de teléfono repetido', () => {
  beforeEach(resetTables);
  afterAll(closePool);

  test('registrar un cliente con el teléfono de otro cliente activo responde 409 con el nombre del existente', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    await createClient({ name: 'Ana Pérez', phone: '55 1234 5678' });

    const res = await post(token, { name: 'Otra Ana', phone: '55 1234 5678' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PHONE_DUPLICATE');
    expect(res.body.error.message).toMatch(/Ana Pérez/);
    expect(res.body.error.details).toEqual([{ field: 'phone', message: expect.stringContaining('Ana Pérez') }]);
  });

  test('la comparación ignora espacios, guiones y paréntesis', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    await createClient({ name: 'Ana Pérez', phone: '55 1234 5678' });

    for (const telefono of ['(55) 1234-5678', '5512345678', '+55 12345678']) {
      const res = await post(token, { name: 'Otra Ana', phone: telefono });
      // '+55 12345678' tiene los mismos dígitos que '5512345678'.
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PHONE_DUPLICATE');
    }
  });

  test('con confirmDuplicate verdadero se guarda de todos modos', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    await createClient({ name: 'Ana Pérez', phone: '55 1234 5678' });

    const res = await post(token, { name: 'Otra Ana', phone: '(55) 1234-5678', confirmDuplicate: true });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Otra Ana');
  });

  test('un cliente desactivado no cuenta como duplicado', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    await createClient({ name: 'Cliente de baja', phone: '55 1234 5678', active: false });
    const res = await post(token, { name: 'Ana Nueva', phone: '55 1234 5678' });
    expect(res.status).toBe(201);
  });

  test('un teléfono distinto no genera aviso', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    await createClient({ name: 'Ana Pérez', phone: '55 1234 5678' });
    const res = await post(token, { name: 'Luis Gómez', phone: '55 9999 0000' });
    expect(res.status).toBe(201);
  });

  test('al editar, el propio cliente no cuenta como duplicado', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const ana = await createClient({ name: 'Ana Pérez', phone: '55 1234 5678' });
    const res = await put(token, ana.id, { name: 'Ana Pérez Gómez', phone: '(55) 1234-5678' });
    expect(res.status).toBe(200);
  });

  test('al editar con el teléfono de otro cliente activo avisa y permite confirmar', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    await createClient({ name: 'Ana Pérez', phone: '55 1234 5678' });
    const luis = await createClient({ name: 'Luis Gómez', phone: '55 9999 0000' });

    const aviso = await put(token, luis.id, { name: 'Luis Gómez', phone: '5512345678' });
    expect(aviso.status).toBe(409);
    expect(aviso.body.error.code).toBe('PHONE_DUPLICATE');

    const confirmado = await put(token, luis.id, { name: 'Luis Gómez', phone: '5512345678', confirmDuplicate: true });
    expect(confirmado.status).toBe(200);
  });

  test('confirmDuplicate debe ser un valor booleano', async () => {
    const { token } = await loginAs('RECEPTIONIST');
    const res = await post(token, { name: 'Ana', phone: '5512345678', confirmDuplicate: 'si' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain('confirmDuplicate');
  });

  test('el mecánico sigue recibiendo 403 al registrar', async () => {
    const { token } = await loginAs('MECHANIC');
    const res = await post(token, { name: 'Ana', phone: '5512345678', confirmDuplicate: true });
    expect(res.status).toBe(403);
  });
});
