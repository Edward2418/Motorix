import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createUser, createPart, TEST_PASSWORD } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';
import { escenarioPago, registrarPago, cancelarPago } from '../helpers/payments.js';

beforeEach(resetTables);
afterAll(closePool);

const registros = async (accion) => (await pool.query('SELECT * FROM audit_log WHERE action = ? ORDER BY id', [accion]))[0];
const todos = async () => (await pool.query('SELECT * FROM audit_log ORDER BY id'))[0];
const iniciarSesion = (identifier, password = TEST_PASSWORD) => request(app).post('/api/auth/login').send({ identifier, password });

const crearUsuario = (token, extra = {}) =>
  request(app)
    .post('/api/users')
    .set(bearer(token))
    .send({ username: 'nuevo.usuario', name: 'Nuevo Usuario', email: 'nuevo@motorix.test', password: 'Clave2026Segura', role: 'RECEPTIONIST', ...extra });

describe('inicios de sesión fallidos y bloqueos', () => {
  test('un inicio fallido de una cuenta existente registra LOGIN_FAILED con su usuario', async () => {
    const lucia = await createUser({ username: 'lucia', role: 'RECEPTIONIST' });

    const res = await iniciarSesion('lucia', 'Incorrecta1');

    expect(res.status).toBe(401);
    const filas = await registros('LOGIN_FAILED');
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ user_id: lucia.id, actor: 'lucia', entity: 'USER', entity_id: lucia.id });
    expect(filas[0].created_at).toBeInstanceOf(Date);
  });

  test('cinco fallos seguidos registran cinco LOGIN_FAILED y un ACCOUNT_LOCKED; los intentos bloqueados no registran más', async () => {
    const lucia = await createUser({ username: 'lucia', role: 'RECEPTIONIST' });
    for (let i = 0; i < 5; i += 1) {
      await iniciarSesion('lucia', 'Incorrecta1');
    }
    const bloqueada = await iniciarSesion('lucia', 'Incorrecta1');

    expect(bloqueada.status).toBe(429);
    expect(await registros('LOGIN_FAILED')).toHaveLength(5);
    const bloqueos = await registros('ACCOUNT_LOCKED');
    expect(bloqueos).toHaveLength(1);
    expect(bloqueos[0]).toMatchObject({ user_id: lucia.id, actor: 'lucia', entity: 'USER' });
  });

  test('con una cuenta inexistente no se guarda el texto escrito (puede ser una contraseña)', async () => {
    const escrito = 'Secreta-Zx9-que-parece-clave';

    const res = await iniciarSesion(escrito, 'Incorrecta1');

    expect(res.status).toBe(401);
    const filas = await registros('LOGIN_FAILED');
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ user_id: null, actor: null });
    expect(JSON.stringify(await todos())).not.toContain('Zx9');
  });

  test('un inicio de sesión correcto no registra nada', async () => {
    await createUser({ username: 'lucia', role: 'RECEPTIONIST' });
    await iniciarSesion('lucia');
    expect(await todos()).toHaveLength(0);
  });
});

describe('usuarios', () => {
  test('el alta registra USER_CREATED con quién la hizo y sin la contraseña', async () => {
    const { token, user } = await loginAs('ADMIN');

    const res = await crearUsuario(token);

    expect(res.status).toBe(201);
    const filas = await registros('USER_CREATED');
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ user_id: user.id, actor: 'admin', entity: 'USER', entity_id: res.body.data.id });
    expect(JSON.stringify(filas)).not.toContain('Clave2026Segura');
  });

  test('desactivar y reactivar registran USER_DEACTIVATED y USER_ACTIVATED; repetir el mismo estado no registra', async () => {
    const { token } = await loginAs('ADMIN');
    const creado = (await crearUsuario(token)).body.data;
    const estado = (active) => request(app).patch(`/api/users/${creado.id}/status`).set(bearer(token)).send({ active });

    await estado(false);
    await estado(false);
    await estado(true);

    expect(await registros('USER_DEACTIVATED')).toHaveLength(1);
    expect(await registros('USER_ACTIVATED')).toHaveLength(1);
    expect((await registros('USER_DEACTIVATED'))[0]).toMatchObject({ entity: 'USER', entity_id: creado.id });
  });

  test('cambiar el rol registra USER_ROLE_CHANGED con «rol: A → B»; editar otros datos no registra', async () => {
    const { token } = await loginAs('ADMIN');
    const creado = (await crearUsuario(token)).body.data;
    const editar = (cuerpo) => request(app).put(`/api/users/${creado.id}`).set(bearer(token)).send({ name: 'Nuevo Usuario', email: 'nuevo@motorix.test', role: 'RECEPTIONIST', ...cuerpo });

    await editar({ name: 'Otro nombre' });
    expect(await registros('USER_ROLE_CHANGED')).toHaveLength(0);
    const res = await editar({ role: 'ADMIN' });

    expect(res.status).toBe(200);
    const filas = await registros('USER_ROLE_CHANGED');
    expect(filas).toHaveLength(1);
    expect(filas[0].detail).toBe('rol: RECEPTIONIST → ADMIN');
    expect(filas[0]).toMatchObject({ entity: 'USER', entity_id: creado.id });
  });
});

describe('configuración', () => {
  test('cada dato que cambia registra SETTINGS_CHANGED con su valor anterior y el nuevo', async () => {
    const { token, user } = await loginAs('ADMIN');

    await request(app).put('/api/settings').set(bearer(token)).send({ workshop: { name: 'Taller Los Pinos' }, maintenance: { soonDays: 15 } });

    const filas = await registros('SETTINGS_CHANGED');
    expect(filas).toHaveLength(2);
    expect(filas.every((fila) => fila.user_id === user.id && fila.entity === 'SETTING')).toBe(true);
    const detalles = filas.map((fila) => fila.detail).sort();
    expect(detalles.some((d) => d.startsWith('nombre del taller:') && d.includes('→ Taller Los Pinos'))).toBe(true);
    expect(detalles.some((d) => d.startsWith('margen en días: 30 → 15'))).toBe(true);
  });

  test('guardar el mismo valor otra vez no registra nada', async () => {
    const { token } = await loginAs('ADMIN');
    await request(app).put('/api/settings').set(bearer(token)).send({ workshop: { name: 'Taller Los Pinos' } });
    const antes = (await registros('SETTINGS_CHANGED')).length;

    await request(app).put('/api/settings').set(bearer(token)).send({ workshop: { name: 'Taller Los Pinos' } });

    expect(await registros('SETTINGS_CHANGED')).toHaveLength(antes);
  });

  test('un guardado inválido no registra nada', async () => {
    const { token } = await loginAs('ADMIN');
    await request(app).put('/api/settings').set(bearer(token)).send({ workshop: { name: '' } });
    expect(await registros('SETTINGS_CHANGED')).toHaveLength(0);
  });
});

describe('precios de refacciones', () => {
  const editar = (token, id, cuerpo) => request(app).put(`/api/parts/${id}`).set(bearer(token)).send(cuerpo);

  test('cambiar el precio de venta registra PART_PRICE_CHANGED con los importes anterior y nuevo', async () => {
    const { token, user } = await loginAs('ADMIN');
    const pieza = await createPart({ code: 'BUJ-1', purchasePrice: 100, salePrice: 180 });

    const res = await editar(token, pieza.id, { salePrice: 250 });

    expect(res.status).toBe(200);
    const filas = await registros('PART_PRICE_CHANGED');
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ user_id: user.id, entity: 'PART', entity_id: pieza.id });
    expect(filas[0].detail).toContain('precio de venta: 180.00 → 250.00');
  });

  test('cambiar los dos precios registra dos acciones', async () => {
    const { token } = await loginAs('ADMIN');
    const pieza = await createPart({ code: 'BUJ-1', purchasePrice: 100, salePrice: 180 });

    await editar(token, pieza.id, { purchasePrice: 120, salePrice: 260 });

    expect(await registros('PART_PRICE_CHANGED')).toHaveLength(2);
  });

  test('cambiar otro dato (mínimo, nombre) o dejar el mismo precio no registra', async () => {
    const { token } = await loginAs('ADMIN');
    const pieza = await createPart({ code: 'BUJ-1', purchasePrice: 100, salePrice: 180 });

    await editar(token, pieza.id, { minStock: 9, name: 'Bujía nueva' });
    await editar(token, pieza.id, { salePrice: 180 });

    expect(await registros('PART_PRICE_CHANGED')).toHaveLength(0);
  });
});

describe('pagos cancelados', () => {
  test('cancelar un pago registra PAYMENT_CANCELLED sin el motivo ni datos de pago', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'TERMINADO', total: 1000 });
    const pago = await registrarPago(tokens.recepcion, orden.id, { amount: 400, method: 'EFECTIVO' });
    const id = pago.body.data.payment.id;

    const res = await cancelarPago(tokens.admin, id, { reason: 'Motivo-reservado-QWERTY' });

    expect(res.status).toBe(200);
    const filas = await registros('PAYMENT_CANCELLED');
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ entity: 'PAYMENT', entity_id: id });
    expect(JSON.stringify(filas)).not.toContain('QWERTY');
  });

  test('un pago que no se pudo cancelar no registra nada', async () => {
    const { orden, tokens } = await escenarioPago({ status: 'TERMINADO', total: 1000 });
    const pago = await registrarPago(tokens.recepcion, orden.id, { amount: 400, method: 'EFECTIVO' });
    const id = pago.body.data.payment.id;
    await cancelarPago(tokens.admin, id, { reason: 'Primera vez' });
    const antes = (await registros('PAYMENT_CANCELLED')).length;

    const otra = await cancelarPago(tokens.admin, id, { reason: 'Segunda vez' });

    expect(otra.status).toBeGreaterThanOrEqual(400);
    expect(await registros('PAYMENT_CANCELLED')).toHaveLength(antes);
  });
});

describe('la bitácora nunca guarda secretos', () => {
  test('tras todas las acciones no hay contraseñas, hashes, tokens ni números de tarjeta en ningún registro', async () => {
    const { token } = await loginAs('ADMIN');
    await iniciarSesion('inexistente', 'Incorrecta1');
    const creado = (await crearUsuario(token)).body.data;
    await request(app).put(`/api/users/${creado.id}`).set(bearer(token)).send({ name: 'Nuevo Usuario', email: 'nuevo@motorix.test', role: 'ADMIN' });
    await request(app).put('/api/settings').set(bearer(token)).send({ workshop: { phone: '55 1234 5678' } });
    const pieza = await createPart({ code: 'BUJ-1', purchasePrice: 100, salePrice: 180 });
    await request(app).put(`/api/parts/${pieza.id}`).set(bearer(token)).send({ salePrice: 300 });

    const texto = JSON.stringify(await todos());

    expect(texto).not.toContain('$2b$');
    expect(texto).not.toContain('eyJ');
    expect(texto).not.toContain('Clave2026Segura');
    expect(texto).not.toContain(TEST_PASSWORD);
    expect(texto).not.toMatch(/\d{13,}/);
    expect(texto).not.toMatch(/password_hash|passwordHash/);
  });

  test('un teléfono largo (que parece un número de tarjeta) no rompe el guardado de la configuración', async () => {
    const { token } = await loginAs('ADMIN');

    const res = await request(app).put('/api/settings').set(bearer(token)).send({ workshop: { phone: '+52 55 1234 5678 9012' } });

    expect(res.status).toBe(200);
    const filas = await registros('SETTINGS_CHANGED');
    expect(filas).toHaveLength(1);
    expect(filas[0].detail).not.toMatch(/\d{13,}/);
  });
});
