import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createPart } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';

afterAll(closePool);

describe('instantánea del precio con cambios simultáneos', () => {
  test('si el precio cambia al mismo tiempo que el alta, la línea toma el precio anterior o el nuevo, nunca otro valor', async () => {
    const vistos = new Set();
    for (let intento = 1; intento <= 8; intento += 1) {
      await resetTables();
      const { orden, tokens } = await escenarioOrden('EN_REPARACION');
      const pieza = await createPart({ code: 'FIL-ACE', stock: 20, purchasePrice: 50, salePrice: 100 });

      const [alta, cambio] = await Promise.all([
        request(app).post(`/api/orders/${orden.id}/parts`).set(bearer(tokens.mecanico)).send({ partId: pieza.id, quantity: 2 }),
        request(app).put(`/api/parts/${pieza.id}`).set(bearer(tokens.admin)).send({ salePrice: 300 })
      ]);
      expect(alta.status).toBe(201);
      expect(cambio.status).toBe(200);

      const [lineas] = await pool.query('SELECT unit_price FROM order_parts WHERE order_id = ?', [orden.id]);
      expect(lineas).toHaveLength(1);
      const precio = Number(lineas[0].unit_price);
      expect([100, 300]).toContain(precio);
      vistos.add(precio);
    }
    // Información para el registro de calidad: qué valores se observaron en las 8 repeticiones.
    expect([...vistos].every((precio) => precio === 100 || precio === 300)).toBe(true);
  });
});
