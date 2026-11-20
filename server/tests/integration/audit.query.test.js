import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool } from '../helpers/db.js';
import { loginAs, bearer } from '../helpers/auth.js';

beforeEach(resetTables);
afterAll(closePool);

const consultar = (token, consulta = '') => request(app).get(`/api/audit-log${consulta}`).set(bearer(token));

// Inserta un registro con la fecha dada (la bitácora no se edita desde la aplicación; las pruebas escriben directo).
async function insertar({ userId = null, actor = null, action = 'SETTINGS_CHANGED', detail = null, creado }) {
  await pool.query('INSERT INTO audit_log (user_id, actor, action, entity, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
    userId,
    actor,
    action,
    'SETTING',
    detail,
    creado
  ]);
}

const fecha = (texto) => new Date(`${texto}T12:00:00`);

describe('consulta de la bitácora', () => {
  test('devuelve los registros de la más reciente a la más antigua, con el total en meta', async () => {
    const { token } = await loginAs('ADMIN');
    await insertar({ detail: 'uno', creado: fecha('2026-11-01') });
    await insertar({ detail: 'dos', creado: fecha('2026-11-03') });
    await insertar({ detail: 'tres', creado: fecha('2026-11-02') });

    const res = await consultar(token);

    expect(res.status).toBe(200);
    expect(res.body.data.map((fila) => fila.detail)).toEqual(['dos', 'tres', 'uno']);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 50, total: 3 });
  });

  test('filtra por rango de fechas, con los dos días incluidos', async () => {
    const { token } = await loginAs('ADMIN');
    await insertar({ detail: 'antes', creado: fecha('2026-10-31') });
    await insertar({ detail: 'primer día', creado: fecha('2026-11-01') });
    await insertar({ detail: 'último día', creado: fecha('2026-11-05') });
    await insertar({ detail: 'después', creado: fecha('2026-11-06') });

    const res = await consultar(token, '?from=2026-11-01&to=2026-11-05');

    expect(res.body.data.map((fila) => fila.detail).sort()).toEqual(['primer día', 'último día']);
    expect(res.body.meta.total).toBe(2);
  });

  test('filtra por usuario y por acción', async () => {
    const { token, user } = await loginAs('ADMIN');
    await insertar({ userId: user.id, actor: 'admin', action: 'USER_CREATED', creado: fecha('2026-11-01') });
    await insertar({ userId: user.id, actor: 'admin', action: 'PART_PRICE_CHANGED', creado: fecha('2026-11-02') });
    await insertar({ userId: 999, actor: 'otro', action: 'USER_CREATED', creado: fecha('2026-11-03') });

    const porUsuario = await consultar(token, `?userId=${user.id}`);
    const porAccion = await consultar(token, '?action=USER_CREATED');
    const ambos = await consultar(token, `?userId=${user.id}&action=USER_CREATED`);

    expect(porUsuario.body.meta.total).toBe(2);
    expect(porAccion.body.meta.total).toBe(2);
    expect(ambos.body.data).toHaveLength(1);
    expect(ambos.body.data[0].action).toBe('USER_CREATED');
  });

  test('pagina: 50 por defecto, el tamaño pedido y hasta 200', async () => {
    const { token } = await loginAs('ADMIN');
    for (let i = 0; i < 7; i += 1) {
      await insertar({ detail: `registro ${i}`, creado: fecha('2026-11-01') });
    }

    const primera = await consultar(token, '?pageSize=3&page=1');
    const tercera = await consultar(token, '?pageSize=3&page=3');
    const maximo = await consultar(token, '?pageSize=200');

    expect(primera.body.data).toHaveLength(3);
    expect(primera.body.meta).toEqual({ page: 1, pageSize: 3, total: 7 });
    expect(tercera.body.data).toHaveLength(1);
    expect(maximo.status).toBe(200);
    expect(maximo.body.meta.pageSize).toBe(200);
  });

  test.each([
    ['un tamaño de página de 201', '?pageSize=201'],
    ['una página 0', '?page=0'],
    ['un tamaño de página que no es número', '?pageSize=abc'],
    ['una fecha inicial mal escrita', '?from=01/11/2026'],
    ['una fecha que no existe', '?from=2026-02-30'],
    ['un rango con from posterior a to', '?from=2026-11-10&to=2026-11-01'],
    ['una acción desconocida', '?action=BORRAR_TODO'],
    ['un usuario que no es número', '?userId=abc']
  ])('responde 400 VALIDATION_ERROR con %s', async (_nombre, consulta) => {
    const { token } = await loginAs('ADMIN');
    const res = await consultar(token, consulta);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test.each(['RECEPTIONIST', 'MECHANIC'])('el rol %s recibe 403', async (rol) => {
    const { token } = await loginAs(rol);
    const res = await consultar(token);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('sin token responde 401', async () => {
    expect((await request(app).get('/api/audit-log')).status).toBe(401);
  });
});

describe('la bitácora no se puede editar ni borrar desde la aplicación', () => {
  test.each([
    ['PUT', '/api/audit-log'],
    ['PATCH', '/api/audit-log'],
    ['DELETE', '/api/audit-log'],
    ['PUT', '/api/audit-log/1'],
    ['PATCH', '/api/audit-log/1'],
    ['DELETE', '/api/audit-log/1'],
    ['POST', '/api/audit-log']
  ])('%s %s responde 404 aunque sea administrador', async (metodo, ruta) => {
    const { token } = await loginAs('ADMIN');
    await insertar({ detail: 'intocable', creado: fecha('2026-11-01') });

    const res = await request(app)[metodo.toLowerCase()](ruta).set(bearer(token)).send({ detail: 'cambiado' });

    expect(res.status).toBe(404);
    const [[fila]] = await pool.query('SELECT detail FROM audit_log LIMIT 1');
    expect(fila.detail).toBe('intocable');
  });
});
