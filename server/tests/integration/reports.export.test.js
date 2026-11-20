import request from 'supertest';
import app from '../../app.js';
import { resetTables, closePool, createPayment } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';
import { escenarioOrden } from '../helpers/orders.js';

beforeEach(resetTables);
afterAll(closePool);

const BOM = '﻿';
const METODOS = { EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia', MERCADO_PAGO: 'Mercado Pago' };
const OCTUBRE = 'from=2026-10-01&to=2026-10-31';

const pedirJson = (token, consulta = OCTUBRE) => request(app).get(`/api/reports/income?${consulta}`).set(bearer(token));
const pedirCsv = (token, consulta = OCTUBRE) =>
  request(app)
    .get(`/api/reports/income?${consulta}&format=csv`)
    .set(bearer(token))
    .buffer(true)
    .parse((res, callback) => {
      const trozos = [];
      res.on('data', (t) => trozos.push(t));
      res.on('end', () => callback(null, Buffer.concat(trozos).toString('utf8')));
    });

// Lector mínimo de CSV (comillas dobles escapadas por duplicación), suficiente para estas pruebas.
function leerCsv(texto) {
  const filas = [];
  let fila = [];
  let campo = '';
  let comillas = false;
  const cuerpo = texto.replace(BOM, '');
  for (let i = 0; i < cuerpo.length; i += 1) {
    const c = cuerpo[i];
    if (comillas) {
      if (c === '"' && cuerpo[i + 1] === '"') {
        campo += '"';
        i += 1;
      } else if (c === '"') {
        comillas = false;
      } else {
        campo += c;
      }
    } else if (c === '"') {
      comillas = true;
    } else if (c === ',') {
      fila.push(campo);
      campo = '';
    } else if (c === '\r' && cuerpo[i + 1] === '\n') {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
      i += 1;
    } else {
      campo += c;
    }
  }
  return filas;
}

async function conPagos() {
  const { orden, tokens } = await escenarioOrden('TERMINADO');
  const pagos = [
    [500.5, 'EFECTIVO', new Date(2026, 9, 5, 10, 0)],
    [250, 'EFECTIVO', new Date(2026, 9, 5, 18, 0)],
    [300.1, 'TARJETA', new Date(2026, 9, 3, 11, 0)],
    [1200.05, 'TRANSFERENCIA', new Date(2026, 9, 20, 9, 0)]
  ];
  for (const [amount, method, paidAt] of pagos) {
    await createPayment({ orderId: orden.id, amount, method, paidAt });
  }
  return tokens.admin;
}

describe('cabeceras de la respuesta', () => {
  test('format=csv responde text/csv con charset utf-8 y como archivo adjunto con nombre que incluye el rango', async () => {
    const token = await conPagos();

    const res = await pedirCsv(token);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toBe('attachment; filename="ingresos-2026-10-01-a-2026-10-31.csv"');
  });

  test('el archivo empieza con la marca BOM UTF-8', async () => {
    const token = await conPagos();
    expect((await pedirCsv(token)).body.startsWith(BOM)).toBe(true);
  });

  test('format=json y sin format siguen respondiendo JSON', async () => {
    const token = await conPagos();
    for (const consulta of [OCTUBRE, `${OCTUBRE}&format=json`]) {
      const res = await pedirJson(token, consulta);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body.data.total).toBe(2250.65);
    }
  });
});

describe('el CSV coincide con la respuesta JSON del mismo rango', () => {
  test('mismas filas por método y por día, y el mismo total', async () => {
    const token = await conPagos();
    const { data } = (await pedirJson(token)).body;

    const filas = leerCsv((await pedirCsv(token)).body);

    expect(filas[0]).toEqual(['Sección', 'Concepto', 'Pagos', 'Total']);
    const porMetodo = filas.filter((f) => f[0] === 'Por método de pago');
    expect(porMetodo).toHaveLength(data.byMethod.length);
    for (const m of data.byMethod) {
      expect(porMetodo).toContainEqual(['Por método de pago', METODOS[m.method], String(m.count), m.total.toFixed(2)]);
    }
    const porDia = filas.filter((f) => f[0] === 'Por día');
    expect(porDia).toEqual(data.byDay.map((d) => ['Por día', d.date, '', d.total.toFixed(2)]));
    expect(filas.at(-1)).toEqual(['Total', '', String(data.paymentsCount), data.total.toFixed(2)]);
  });

  test('la suma de las filas del CSV (en centavos) es exactamente el total del archivo y del JSON', async () => {
    const token = await conPagos();
    const filas = leerCsv((await pedirCsv(token)).body);
    const centavos = (f) => Math.round(Number(f[3]) * 100);

    const totalMetodos = filas.filter((f) => f[0] === 'Por método de pago').reduce((s, f) => s + centavos(f), 0);
    const totalDias = filas.filter((f) => f[0] === 'Por día').reduce((s, f) => s + centavos(f), 0);

    expect(totalMetodos).toBe(centavos(filas.at(-1)));
    expect(totalDias).toBe(centavos(filas.at(-1)));
    expect(centavos(filas.at(-1))).toBe(Math.round((await pedirJson(token)).body.data.total * 100));
  });

  test('un rango sin pagos exporta los encabezados y el total en cero, igual que el JSON', async () => {
    const { tokens } = await escenarioOrden('TERMINADO');

    const filas = leerCsv((await pedirCsv(tokens.admin)).body);

    expect(filas).toEqual([
      ['Sección', 'Concepto', 'Pagos', 'Total'],
      ['Total', '', '0', '0.00']
    ]);
    expect((await pedirJson(tokens.admin)).body.data).toMatchObject({ total: 0, paymentsCount: 0 });
  });

  test('el CSV solo trae lo que trae la pantalla: nada de referencias, órdenes ni usuarios', async () => {
    const { orden, tokens } = await escenarioOrden('TERMINADO');
    await createPayment({ orderId: orden.id, amount: 100, method: 'TRANSFERENCIA', paidAt: new Date(2026, 9, 2, 10, 0), reference: 'SPEI-SECRETO-123' });

    const texto = (await pedirCsv(tokens.admin)).body;

    expect(texto).not.toContain('SPEI-SECRETO-123');
    expect(texto).not.toMatch(/reference|orderId|createdBy/i);
  });
});

describe('errores y permisos', () => {
  test('un format distinto de json o csv responde 400', async () => {
    const { tokens } = await escenarioOrden('TERMINADO');
    for (const formato of ['xml', 'pdf', 'xlsx', 'CSV ']) {
      const res = await pedirJson(tokens.admin, `${OCTUBRE}&format=${encodeURIComponent(formato)}`);
      expect({ formato, status: res.status }).toEqual({ formato, status: 400 });
    }
  });

  test('un rango inválido con format=csv responde el error en JSON, no un archivo', async () => {
    const { tokens } = await escenarioOrden('TERMINADO');
    const res = await request(app).get('/api/reports/income?from=2026-10-31&to=2026-10-01&format=csv').set(bearer(tokens.admin));
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.error.code).toBe('REPORT_RANGE_INVALID');
  });

  test.each(['RECEPTIONIST', 'MECHANIC'])('el rol %s recibe 403 también con format=csv', async (rol) => {
    const { token } = await loginAs(rol);
    const res = await request(app).get(`/api/reports/income?${OCTUBRE}&format=csv`).set(bearer(token));
    expect(res.status).toBe(403);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  test('sin token responde 401', async () => {
    expect((await request(app).get(`/api/reports/income?${OCTUBRE}&format=csv`)).status).toBe(401);
  });
});
