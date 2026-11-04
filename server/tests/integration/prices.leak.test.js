import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, addServiceLine, createPart, createOrderPart, createPayment } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';

afterAll(closePool);

const PRECIO_DE_COMPRA = 73.41;
const PRECIO_DE_VENTA = 188.88;

// Prepara una orden terminada con una refacción de precio de compra y de venta conocidos (en las alertas de stock), un
// servicio, un pago, el ticket emitido y el historial del vehículo derivado de la orden.
async function preparar() {
  const escenario = await escenarioOrden('TERMINADO');
  const { orden, tokens } = escenario;
  const pieza = await createPart({
    code: 'FIL-ACE',
    name: 'Filtro de aceite',
    stock: 5,
    minStock: 5,
    purchasePrice: PRECIO_DE_COMPRA,
    salePrice: PRECIO_DE_VENTA
  });
  await createOrderPart({ orderId: orden.id, partId: pieza.id, quantity: 1 });
  await addServiceLine(orden.id, 'Servicio', 500);
  await createPayment({ orderId: orden.id, amount: 300, method: 'EFECTIVO' });
  const ticket = await request(app).post(`/api/orders/${orden.id}/ticket`).set(bearer(tokens.recepcion));
  expect(ticket.status).toBe(201);
  return { ...escenario, pieza };
}

// Todas las consultas del sistema que pueden devolver refacciones, órdenes, pagos, tickets, historial, inventario,
// alertas de stock, movimientos o el panel de control.
function rutasDeConsulta({ orden, vehicle, pieza }) {
  return [
    ['inventario: listado', '/api/parts'],
    ['inventario: búsqueda', '/api/parts?search=FIL'],
    ['inventario: detalle', `/api/parts/${pieza.id}`],
    ['inventario: categorías', '/api/parts/categories'],
    ['alertas de stock', '/api/parts/alerts'],
    ['movimientos de inventario', `/api/parts/${pieza.id}/movements`],
    ['órdenes: listado', '/api/orders'],
    ['órdenes: listado filtrado', '/api/orders?status=TERMINADO'],
    ['órdenes: detalle', `/api/orders/${orden.id}`],
    ['pagos de la orden', `/api/orders/${orden.id}/payments`],
    ['ticket de la orden', `/api/orders/${orden.id}/ticket`],
    ['historial del vehículo', `/api/vehicles/${vehicle.id}/history`],
    ['vehículo: detalle', `/api/vehicles/${vehicle.id}`],
    ['mantenimientos', '/api/maintenance'],
    ['panel de control', '/api/dashboard'],
    ['panel de control: semana', '/api/dashboard?period=week']
  ];
}

const contieneElPrecioDeCompra = (texto) => /purchase/i.test(texto) || texto.includes(String(PRECIO_DE_COMPRA));

describe('el precio de compra solo llega a la administración', () => {
  beforeEach(resetTables);

  test('recepción y mecánico no reciben el precio de compra en ninguna consulta (clave ni valor)', async () => {
    const escenario = await preparar();
    const rutas = rutasDeConsulta(escenario);
    const roles = { administración: escenario.tokens.admin, recepción: escenario.tokens.recepcion, mecánico: escenario.tokens.mecanico };

    const respuestas = [];
    for (const [rol, token] of Object.entries(roles)) {
      for (const [nombre, ruta] of rutas) {
        const res = await request(app).get(ruta).set(bearer(token));
        respuestas.push({ rol, nombre, ruta, status: res.status, texto: JSON.stringify(res.body) });
      }
    }

    // La administración puede consultar todas las rutas: así se sabe que ninguna ruta de la lista está mal escrita.
    for (const r of respuestas.filter((item) => item.rol === 'administración')) {
      expect({ ruta: r.nombre, status: r.status }).toEqual({ ruta: r.nombre, status: 200 });
    }

    const filtraciones = respuestas
      .filter((item) => item.rol !== 'administración' && contieneElPrecioDeCompra(item.texto))
      .map((item) => `${item.rol} · ${item.nombre}`);
    expect(filtraciones).toEqual([]);

    // Para que la prueba no sea vacía, recepción y mecánico deben haber consultado varias rutas con éxito.
    for (const rol of ['recepción', 'mecánico']) {
      const exitosas = respuestas.filter((item) => item.rol === rol && item.status === 200);
      expect(exitosas.length).toBeGreaterThanOrEqual(6);
    }
  });

  test('controles positivos: la administración sí recibe el precio de compra y recepción el de venta', async () => {
    const { orden, pieza, tokens } = await preparar();

    const detalle = await request(app).get(`/api/parts/${pieza.id}`).set(bearer(tokens.admin));
    expect(detalle.body.data).toMatchObject({ purchasePrice: PRECIO_DE_COMPRA, salePrice: PRECIO_DE_VENTA });
    const listado = await request(app).get('/api/parts').set(bearer(tokens.admin));
    expect(listado.body.data[0].purchasePrice).toBe(PRECIO_DE_COMPRA);

    const deRecepcion = await request(app).get(`/api/orders/${orden.id}`).set(bearer(tokens.recepcion));
    expect(deRecepcion.body.data.parts[0].unitPrice).toBe(PRECIO_DE_VENTA);
    const ticket = await request(app).get(`/api/orders/${orden.id}/ticket`).set(bearer(tokens.recepcion));
    expect(ticket.body.data.parts[0].unitPrice).toBe(PRECIO_DE_VENTA);
  });

  test('el mecánico conserva el precio de venta del inventario (lo que ve hoy) y nunca el de compra', async () => {
    const { pieza, tokens } = await preparar();
    const res = await request(app).get(`/api/parts/${pieza.id}`).set(bearer(tokens.mecanico));
    expect(res.status).toBe(200);
    expect(res.body.data.salePrice).toBe(PRECIO_DE_VENTA);
    expect(res.body.data).not.toHaveProperty('purchasePrice');
  });
});
