import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createPart, createOrderPart, createPayment, addServiceLine } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioPago } from '../helpers/payments.js';

beforeEach(resetTables);
afterAll(closePool);

// SC-008: ninguna respuesta de usuarios, refacciones, órdenes, pagos ni tickets incluye el hash de contraseña, el token
// (salvo en el inicio de sesión) ni los precios reservados al rol. Se revisan las llaves y los valores de cada respuesta.
const LLAVES_SECRETAS = /^(password|passwordhash|password_hash|token|accesstoken|access_token|jwt)$/i;
const LLAVES_DE_COMPRA = /^(purchaseprice|purchase_price)$/i;
const HASH_BCRYPT = /\$2[aby]\$\d{2}\$/;
const TOKEN_JWT = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\./;

// Devuelve la lista de problemas encontrados en un valor de respuesta, con la ruta de cada uno.
export function buscarFiltraciones(valor, { permitirToken = false, permitirPrecioDeCompra = true } = {}, ruta = '$') {
  const problemas = [];
  if (typeof valor === 'string') {
    if (HASH_BCRYPT.test(valor)) problemas.push(`${ruta}: contiene un hash de contraseña`);
    if (!permitirToken && TOKEN_JWT.test(valor)) problemas.push(`${ruta}: contiene un token`);
  } else if (Array.isArray(valor)) {
    valor.forEach((item, indice) => problemas.push(...buscarFiltraciones(item, { permitirToken, permitirPrecioDeCompra }, `${ruta}[${indice}]`)));
  } else if (valor && typeof valor === 'object') {
    for (const [llave, contenido] of Object.entries(valor)) {
      if (LLAVES_SECRETAS.test(llave) && !(permitirToken && llave.toLowerCase() === 'token')) {
        problemas.push(`${ruta}.${llave}: llave reservada`);
      }
      if (LLAVES_DE_COMPRA.test(llave) && !permitirPrecioDeCompra) {
        problemas.push(`${ruta}.${llave}: precio de compra reservado a la administración`);
      }
      problemas.push(...buscarFiltraciones(contenido, { permitirToken, permitirPrecioDeCompra }, `${ruta}.${llave}`));
    }
  }
  return problemas;
}

describe('verificación de eficacia: la propia comprobación detecta lo que debe', () => {
  test('detecta hash, token, llaves reservadas y precio de compra', () => {
    expect(buscarFiltraciones({ user: { passwordHash: 'x' } })).toHaveLength(1);
    expect(buscarFiltraciones({ a: { password_hash: 'x' } })).toHaveLength(1);
    expect(buscarFiltraciones({ nota: '$2b$10$abcdefghijklmnopqrstuuAbCdEfGhIjKlMnOpQrStUvWxYz012345' })).toHaveLength(1);
    expect(buscarFiltraciones({ token: 'abc' })).toHaveLength(1);
    expect(buscarFiltraciones({ lista: [{ purchasePrice: 5 }] }, { permitirPrecioDeCompra: false })).toHaveLength(1);
    expect(buscarFiltraciones({ x: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.firma' })).toHaveLength(1);
  });

  test('no marca datos normales ni el precio de compra cuando se permite', () => {
    expect(buscarFiltraciones({ name: 'Ana', salePrice: 10, nota: 'texto cualquiera' })).toEqual([]);
    expect(buscarFiltraciones({ purchasePrice: 5 }, { permitirPrecioDeCompra: true })).toEqual([]);
    expect(buscarFiltraciones({ token: 'abc' }, { permitirToken: true })).toEqual([]);
  });
});

// Una orden terminada con servicio, mano de obra, una refacción con precio de compra, un pago y su ticket.
async function escenarioCompleto() {
  const escenario = await escenarioPago({ status: 'TERMINADO', total: 800 });
  await addServiceLine(escenario.orden.id, 'Mano de obra', 300, 'order_labor');
  const pieza = await createPart({ code: 'BAL-01', name: 'Balatas', stock: 10, purchasePrice: 50, salePrice: 150 });
  await createOrderPart({ orderId: escenario.orden.id, partId: pieza.id, quantity: 2 });
  await createPayment({ orderId: escenario.orden.id, amount: 500, method: 'EFECTIVO' });
  await request(app).post(`/api/orders/${escenario.orden.id}/ticket`).set(bearer(escenario.tokens.recepcion));
  return { ...escenario, pieza };
}

const RUTAS = (e) => [
  '/api/users',
  `/api/users/1`,
  '/api/parts',
  `/api/parts/${e.pieza.id}`,
  '/api/parts/alerts',
  '/api/orders',
  `/api/orders/${e.orden.id}`,
  `/api/orders/${e.orden.id}/payments`,
  `/api/orders/${e.orden.id}/ticket`,
  '/api/auth/me',
  '/api/clients',
  '/api/vehicles',
  '/api/maintenance',
  '/api/dashboard',
  '/api/notifications'
];

describe('las respuestas no exponen datos reservados', () => {
  test.each([
    ['ADMIN', 'admin', true],
    ['RECEPTIONIST', 'recepcion', false],
    ['MECHANIC', 'mecanico', false]
  ])('con el rol %s, ninguna respuesta lleva hash, token ni (según el rol) precio de compra', async (_rol, quien, veCompra) => {
    const escenario = await escenarioCompleto();
    const token = escenario.tokens[quien];
    let revisadas = 0;

    for (const ruta of RUTAS(escenario)) {
      const res = await request(app).get(ruta).set(bearer(token));
      if (res.status !== 200) {
        continue;
      }
      revisadas += 1;
      const problemas = buscarFiltraciones(res.body, { permitirPrecioDeCompra: veCompra });
      expect({ ruta, problemas }).toEqual({ ruta, problemas: [] });
    }

    expect(revisadas).toBeGreaterThan(3);
  });

  test('el administrador sí recibe el precio de compra en el detalle de la refacción (la prueba mira de verdad)', async () => {
    const escenario = await escenarioCompleto();
    const res = await request(app).get(`/api/parts/${escenario.pieza.id}`).set(bearer(escenario.tokens.admin));
    expect(buscarFiltraciones(res.body, { permitirPrecioDeCompra: false })).not.toEqual([]);
  });

  test('crear y editar un usuario no devuelve el hash de contraseña', async () => {
    const escenario = await escenarioCompleto();
    const creado = await request(app)
      .post('/api/users')
      .set(bearer(escenario.tokens.admin))
      .send({ username: 'nuevo.usuario', name: 'Nuevo', email: 'nuevo@motorix.test', password: 'Clave2026Segura', role: 'RECEPTIONIST' });
    expect(creado.status).toBe(201);
    expect(buscarFiltraciones(creado.body)).toEqual([]);

    const editado = await request(app)
      .put(`/api/users/${creado.body.data.id}`)
      .set(bearer(escenario.tokens.admin))
      .send({ name: 'Nuevo', email: 'nuevo@motorix.test', role: 'RECEPTIONIST' });
    expect(buscarFiltraciones(editado.body)).toEqual([]);
  });

  test('el inicio de sesión devuelve el token y ninguna otra llave reservada', async () => {
    const escenario = await escenarioCompleto();
    const [[usuario]] = [(await (await import('../helpers/db.js')).pool.query('SELECT username FROM users LIMIT 1'))[0]];
    const res = await request(app).post('/api/auth/login').send({ identifier: usuario.username, password: 'Prueba2026!' });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(buscarFiltraciones(res.body, { permitirToken: true })).toEqual([]);
    expect(escenario.orden.id).toBeGreaterThan(0);
  });
});
