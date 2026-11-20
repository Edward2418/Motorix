import { AUDIT_ACTIONS, createAuditService } from '../../services/auditService.js';

// Modelo falso: guarda lo que recibe para poder inspeccionarlo, sin tocar la base.
function modeloFalso() {
  const insertados = [];
  return {
    insertados,
    async insert(entrada) {
      insertados.push(entrada);
      return insertados.length;
    },
    async list(filtros) {
      return { data: [], total: 0, filtros };
    }
  };
}

const registro = (extra = {}) => ({
  userId: 7,
  actor: 'admin',
  action: 'SETTINGS_CHANGED',
  entity: 'SETTING',
  entityId: null,
  detail: 'nombre del taller: A → B',
  ...extra
});

describe('acciones permitidas', () => {
  test('son exactamente las nueve de la lista cerrada', () => {
    expect([...AUDIT_ACTIONS].sort()).toEqual(
      [
        'ACCOUNT_LOCKED',
        'LOGIN_FAILED',
        'PART_PRICE_CHANGED',
        'PAYMENT_CANCELLED',
        'SETTINGS_CHANGED',
        'USER_ACTIVATED',
        'USER_CREATED',
        'USER_DEACTIVATED',
        'USER_ROLE_CHANGED'
      ].sort()
    );
  });

  test('una acción desconocida se rechaza y no se guarda nada', async () => {
    const model = modeloFalso();
    const servicio = createAuditService({ model });
    await expect(servicio.record(registro({ action: 'ALGO_RARO' }))).rejects.toThrow(/acción/i);
    expect(model.insertados).toHaveLength(0);
  });

  test.each(AUDIT_ACTIONS)('la acción %s se guarda', async (accion) => {
    const model = modeloFalso();
    await createAuditService({ model }).record(registro({ action: accion }));
    expect(model.insertados).toHaveLength(1);
    expect(model.insertados[0].action).toBe(accion);
  });
});

describe('qué se guarda', () => {
  test('guarda quién, qué entidad y el detalle, y nada más', async () => {
    const model = modeloFalso();
    await createAuditService({ model }).record(
      registro({ contrasena: 'Secreta2026', token: 'abc', cuerpo: { x: 1 } })
    );
    expect(Object.keys(model.insertados[0]).sort()).toEqual(['action', 'actor', 'detail', 'entity', 'entityId', 'userId']);
  });

  test('sin usuario no guarda el actor, aunque se lo pasen', async () => {
    const model = modeloFalso();
    await createAuditService({ model }).record(registro({ userId: null, actor: 'texto-escrito-por-alguien' }));
    expect(model.insertados[0].userId).toBeNull();
    expect(model.insertados[0].actor).toBeNull();
  });

  test('recorta el detalle a 255 caracteres', async () => {
    const model = modeloFalso();
    await createAuditService({ model }).record(registro({ detail: 'x'.repeat(400) }));
    expect(model.insertados[0].detail).toHaveLength(255);
  });

  test('el detalle, la entidad y su id son opcionales', async () => {
    const model = modeloFalso();
    await createAuditService({ model }).record({ userId: 3, actor: 'recepcion', action: 'USER_CREATED' });
    expect(model.insertados[0]).toMatchObject({ detail: null, entity: null, entityId: null });
  });

  test('pasa la conexión de la transacción al modelo', async () => {
    let recibida;
    const model = {
      async insert(_entrada, conn) {
        recibida = conn;
      }
    };
    const conexion = { id: 'conexion-de-prueba' };
    await createAuditService({ model }).record(registro(), conexion);
    expect(recibida).toBe(conexion);
  });
});

describe('secretos que nunca deben llegar a la bitácora', () => {
  const secretos = [
    ['un hash bcrypt', 'cambió a $2b$10$abcdefghijklmnopqrstuuAbCdEfGhIjKlMnOpQrStUvWxYz012345'],
    ['un token JWT', 'sesión eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.firma'],
    ['una contraseña', 'password: Prueba2026!'],
    ['una contraseña en español', 'contraseña = Secreta2026'],
    ['un número de tarjeta', 'pago con 4111111111111111'],
    ['un número de tarjeta con guiones', 'tarjeta 4111-1111-1111-1111']
  ];

  test.each(secretos)('rechaza un detalle que contiene %s', async (_nombre, detalle) => {
    const model = modeloFalso();
    await expect(createAuditService({ model }).record(registro({ detail: detalle }))).rejects.toThrow(/secreto|contraseña|sensible/i);
    expect(model.insertados).toHaveLength(0);
  });

  test('acepta importes y roles, que no son secretos', async () => {
    const model = modeloFalso();
    await createAuditService({ model }).record(
      registro({ action: 'PART_PRICE_CHANGED', detail: 'precio de venta: 180.00 → 250.00' })
    );
    await createAuditService({ model }).record(registro({ action: 'USER_ROLE_CHANGED', detail: 'rol: MECHANIC → ADMIN' }));
    expect(model.insertados).toHaveLength(2);
  });
});

describe('consulta', () => {
  test('list delega al modelo con los filtros recibidos', async () => {
    const model = modeloFalso();
    const filtros = { from: '2026-11-01', page: 2, pageSize: 50 };
    const resultado = await createAuditService({ model }).list(filtros);
    expect(resultado.filtros).toEqual(filtros);
  });
});
