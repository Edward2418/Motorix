import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createPart } from '../helpers/db.js';
import { bearer, loginAs } from '../helpers/auth.js';

afterAll(closePool);

const base = {
  code: 'BUJ-100',
  name: 'Bujía de iridio',
  category: 'Motor',
  brand: 'NGK',
  initialStock: 5,
  minStock: 2,
  purchasePrice: 50,
  salePrice: 80
};

const alta = (token, cuerpo = {}) => request(app).post('/api/parts').set(bearer(token)).send({ ...base, ...cuerpo });
const edicion = (token, id, cuerpo) => request(app).put(`/api/parts/${id}`).set(bearer(token)).send(cuerpo);
const totalDePartes = async () => (await pool.query('SELECT COUNT(*) AS total FROM parts'))[0][0].total;
const preciosDe = async (id) => {
  const [[fila]] = await pool.query('SELECT purchase_price, sale_price FROM parts WHERE id = ?', [id]);
  return { compra: Number(fila.purchase_price), venta: Number(fila.sale_price) };
};

describe('precios de las refacciones', () => {
  beforeEach(resetTables);

  describe('validación de los precios', () => {
    test.each([
      ['negativo', -1],
      ['texto', '100'],
      ['nulo', null],
      ['con más de dos decimales', 10.123],
      ['mayor que el máximo', 100000000]
    ])('un precio %s se rechaza con 400 y un mensaje por campo, al registrar y al editar', async (_nombre, valor) => {
      const { token } = await loginAs('ADMIN');
      for (const campo of ['purchasePrice', 'salePrice']) {
        const res = await alta(token, { [campo]: valor });
        expect(res.status).toBe(400);
        expect(res.body.error.details.map((d) => d.field)).toContain(campo);
        expect(await totalDePartes()).toBe(0);
      }
      const pieza = await createPart({ code: 'EXI-01', purchasePrice: 50, salePrice: 80 });
      const res = await edicion(token, pieza.id, { salePrice: valor });
      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d) => d.field)).toContain('salePrice');
      expect(await preciosDe(pieza.id)).toEqual({ compra: 50, venta: 80 });
    });

    test('el máximo exacto 99,999,999.99 y el cero se aceptan', async () => {
      const { token } = await loginAs('ADMIN');
      const maximo = await alta(token, { code: 'MAX-01', purchasePrice: 99999999.99, salePrice: 99999999.99 });
      expect(maximo.status).toBe(201);
      const cero = await alta(token, { code: 'CER-01', purchasePrice: 0, salePrice: 0 });
      expect(cero.status).toBe(201);
    });

    test('categoría y marca siguen siendo texto libre obligatorio de hasta 60 caracteres', async () => {
      const { token } = await loginAs('ADMIN');
      for (const campo of ['category', 'brand']) {
        expect((await alta(token, { code: `V-${campo}`, [campo]: '' })).status).toBe(400);
        expect((await alta(token, { code: `L-${campo}`, [campo]: 'x'.repeat(61) })).status).toBe(400);
        expect((await alta(token, { code: `O-${campo}`, [campo]: 'x'.repeat(60) })).status).toBe(201);
      }
      expect((await alta(token, { code: 'LIB-01', category: 'frenos  delanteros / ñ' })).status).toBe(201);
    });
  });

  describe('precio de venta menor al de compra: confirmación exigida por el servidor', () => {
    test('sin confirmar responde 422 PRICE_BELOW_COST con detalle en salePrice y no guarda; con confirmar sí guarda', async () => {
      const { token } = await loginAs('ADMIN');
      const sin = await alta(token, { purchasePrice: 100, salePrice: 80 });
      expect(sin.status).toBe(422);
      expect(sin.body.error.code).toBe('PRICE_BELOW_COST');
      expect(sin.body.error.details.map((d) => d.field)).toEqual(['salePrice']);
      expect(await totalDePartes()).toBe(0);

      const falso = await alta(token, { purchasePrice: 100, salePrice: 80, confirmBelowCost: false });
      expect(falso.status).toBe(422);
      expect(await totalDePartes()).toBe(0);

      const con = await alta(token, { purchasePrice: 100, salePrice: 80, confirmBelowCost: true });
      expect(con.status).toBe(201);
      expect(con.body.data).toMatchObject({ purchasePrice: 100, salePrice: 80 });
      expect(con.body.data).not.toHaveProperty('confirmBelowCost');
      expect(await totalDePartes()).toBe(1);
    });

    test('al editar los precios sin confirmar no cambia nada; confirmado sí cambia', async () => {
      const { token } = await loginAs('ADMIN');
      const pieza = await createPart({ code: 'EDI-01', purchasePrice: 50, salePrice: 80 });

      const sin = await edicion(token, pieza.id, { salePrice: 40 });
      expect(sin.status).toBe(422);
      expect(sin.body.error.code).toBe('PRICE_BELOW_COST');
      expect(await preciosDe(pieza.id)).toEqual({ compra: 50, venta: 80 });

      const con = await edicion(token, pieza.id, { salePrice: 40, confirmBelowCost: true });
      expect(con.status).toBe(200);
      expect(await preciosDe(pieza.id)).toEqual({ compra: 50, venta: 40 });
    });

    test('editar solo otros datos de una refacción que ya está bajo el costo no pide confirmar de nuevo', async () => {
      const { token } = await loginAs('ADMIN');
      const pieza = await createPart({ code: 'BAJ-01', purchasePrice: 100, salePrice: 80 });
      const res = await edicion(token, pieza.id, { name: 'Nombre nuevo', minStock: 6 });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Nombre nuevo');
      expect(await preciosDe(pieza.id)).toEqual({ compra: 100, venta: 80 });
    });

    test('subir el precio de compra por encima de la venta exige confirmación', async () => {
      const { token } = await loginAs('ADMIN');
      const pieza = await createPart({ code: 'SUB-01', purchasePrice: 50, salePrice: 60 });
      expect((await edicion(token, pieza.id, { purchasePrice: 70 })).status).toBe(422);
      expect((await edicion(token, pieza.id, { purchasePrice: 70, confirmBelowCost: true })).status).toBe(200);
    });

    test('confirmBelowCost debe ser un booleano', async () => {
      const { token } = await loginAs('ADMIN');
      const res = await alta(token, { purchasePrice: 100, salePrice: 80, confirmBelowCost: 'si' });
      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d) => d.field)).toContain('confirmBelowCost');
    });

    test('enviar solo confirmBelowCost al editar no cuenta como un campo para actualizar', async () => {
      const { token } = await loginAs('ADMIN');
      const pieza = await createPart({ code: 'SOL-01' });
      const res = await edicion(token, pieza.id, { confirmBelowCost: true });
      expect(res.status).toBe(400);
    });
  });

  describe('precio de venta igual a cero', () => {
    test('se permite sin confirmar si el precio de compra también es cero', async () => {
      const { token } = await loginAs('ADMIN');
      const res = await alta(token, { code: 'COR-01', purchasePrice: 0, salePrice: 0 });
      expect(res.status).toBe(201);
      expect(res.body.data.salePrice).toBe(0);
    });

    test('con precio de compra mayor que cero exige la confirmación, porque la venta es menor a la compra', async () => {
      const { token } = await loginAs('ADMIN');
      const sin = await alta(token, { code: 'GAR-01', purchasePrice: 50, salePrice: 0 });
      expect(sin.status).toBe(422);
      expect(sin.body.error.code).toBe('PRICE_BELOW_COST');
      const con = await alta(token, { code: 'GAR-01', purchasePrice: 50, salePrice: 0, confirmBelowCost: true });
      expect(con.status).toBe(201);
      expect(con.body.data.salePrice).toBe(0);
    });
  });

  describe('permisos', () => {
    test('solo la administración registra y edita refacciones: recepción y mecánico reciben 403', async () => {
      const pieza = await createPart({ code: 'PER-01' });
      for (const rol of ['RECEPTIONIST', 'MECHANIC']) {
        const { token } = await loginAs(rol);
        expect((await alta(token, { code: `NUE-${rol}` })).status).toBe(403);
        expect((await edicion(token, pieza.id, { salePrice: 100 })).status).toBe(403);
        expect((await alta(token, { code: `BAJ-${rol}`, purchasePrice: 100, salePrice: 80, confirmBelowCost: true })).status).toBe(403);
      }
      expect(await totalDePartes()).toBe(1);
    });
  });
});
