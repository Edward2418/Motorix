import { createNotificationService } from '../../services/notificationService.js';

const ahora = new Date('2026-11-18T12:00:00Z');

// Modelo falso en memoria: guarda las lecturas como «usuario|clave» -> gravedad.
function modeloFalso(iniciales = []) {
  const lecturas = new Map(iniciales.map((l) => [`${l.userId}|${l.key}`, l.severity]));
  return {
    lecturas,
    async listReads(userId) {
      return [...lecturas.entries()]
        .filter(([k]) => k.startsWith(`${userId}|`))
        .map(([k, severity]) => ({ key: k.slice(String(userId).length + 1), severity }));
    },
    async upsertRead(userId, key, severity) {
      lecturas.set(`${userId}|${key}`, severity);
    },
    async deleteReadsNotIn(userId, activeKeys) {
      const activas = new Set(activeKeys);
      for (const k of [...lecturas.keys()]) {
        if (k.startsWith(`${userId}|`) && !activas.has(k.slice(String(userId).length + 1))) {
          lecturas.delete(k);
        }
      }
    }
  };
}

// Proveedor falso: devuelve `cantidad` avisos con claves PREFIJO:1..N.
function proveedor(type, prefix, cantidad, extra = {}) {
  const llamadas = { list: 0, keys: 0 };
  const items = Array.from({ length: cantidad }, (_, i) => ({
    key: `${prefix}:${i + 1}`,
    title: `${type} ${i + 1}`,
    detail: 'detalle',
    target: { module: 'inventory', id: i + 1 }
  }));
  return {
    type,
    llamadas,
    async list() {
      llamadas.list += 1;
      return items;
    },
    ...extra
  };
}

const admin = { id: 1, role: 'ADMIN' };
const mecanico = { id: 2, role: 'MECHANIC' };

describe('lectura de avisos', () => {
  test('un aviso sin lectura es no leído', async () => {
    const servicio = createNotificationService({ providers: [proveedor('STOCK_LOW', 'STOCK', 2)], model: modeloFalso() });
    const centro = await servicio.getCenter(admin, { now: ahora });
    expect(centro.unread).toBe(2);
    expect(centro.groups[0].items.every((aviso) => aviso.read === false)).toBe(true);
  });

  test('un aviso con lectura de igual gravedad es leído', async () => {
    const modelo = modeloFalso([{ userId: 1, key: 'STOCK:1', severity: 1 }]);
    const servicio = createNotificationService({ providers: [proveedor('STOCK_LOW', 'STOCK', 2)], model: modelo });
    const centro = await servicio.getCenter(admin, { now: ahora });
    expect(centro.unread).toBe(1);
    expect(centro.groups[0].items.find((a) => a.key === 'STOCK:1').read).toBe(true);
  });

  test('una lectura de gravedad menor deja el aviso como no leído (empeoró)', async () => {
    const modelo = modeloFalso([{ userId: 1, key: 'STOCK:1', severity: 1 }]);
    const servicio = createNotificationService({ providers: [proveedor('STOCK_OUT', 'STOCK', 1)], model: modelo });
    const centro = await servicio.getCenter(admin, { now: ahora });
    expect(centro.unread).toBe(1);
    expect(centro.groups[0].items[0].read).toBe(false);
    expect(centro.groups[0].items[0].severity).toBe(2);
  });

  test('una lectura de gravedad mayor o igual mantiene el aviso como leído', async () => {
    const modelo = modeloFalso([{ userId: 1, key: 'STOCK:1', severity: 2 }]);
    const servicio = createNotificationService({ providers: [proveedor('STOCK_LOW', 'STOCK', 1)], model: modelo });
    const centro = await servicio.getCenter(admin, { now: ahora });
    expect(centro.unread).toBe(0);
  });
});

describe('proveedores y roles', () => {
  test('solo se consultan los proveedores que el rol puede ver', async () => {
    const stock = proveedor('STOCK_LOW', 'STOCK', 3);
    const detenidas = proveedor('ORDER_STALE', 'ORDER', 2);
    const servicio = createNotificationService({ providers: [stock, detenidas], model: modeloFalso() });
    const centro = await servicio.getCenter(mecanico, { now: ahora });
    expect(stock.llamadas.list).toBe(0);
    expect(detenidas.llamadas.list).toBe(1);
    expect(centro.groups.map((g) => g.type)).toEqual(['ORDER_STALE']);
  });

  test('un rol desconocido no recibe nada', async () => {
    const servicio = createNotificationService({ providers: [proveedor('STOCK_LOW', 'STOCK', 3)], model: modeloFalso() });
    const centro = await servicio.getCenter({ id: 9, role: 'INVITADO' }, { now: ahora });
    expect(centro).toEqual({ unread: 0, groups: [] });
  });

  test('un grupo vacío se omite', async () => {
    const servicio = createNotificationService({
      providers: [proveedor('STOCK_LOW', 'STOCK', 0), proveedor('STOCK_OUT', 'STOCK', 1)],
      model: modeloFalso()
    });
    const centro = await servicio.getCenter(admin, { now: ahora });
    expect(centro.groups.map((g) => g.type)).toEqual(['STOCK_OUT']);
  });
});

describe('totales y límite de elementos', () => {
  test('el grupo trae el total exacto y hasta 10 elementos', async () => {
    const servicio = createNotificationService({ providers: [proveedor('STOCK_LOW', 'STOCK', 12)], model: modeloFalso() });
    const centro = await servicio.getCenter(admin, { now: ahora });
    expect(centro.groups[0].total).toBe(12);
    expect(centro.groups[0].items).toHaveLength(10);
    expect(centro.groups[0].unread).toBe(12);
  });

  test('unread suma los no leídos de todos los grupos', async () => {
    const modelo = modeloFalso([{ userId: 1, key: 'MAINT:1', severity: 1 }]);
    const servicio = createNotificationService({
      providers: [proveedor('MAINTENANCE_SOON', 'MAINT', 2), proveedor('STOCK_OUT', 'STOCK', 3)],
      model: modelo
    });
    const centro = await servicio.getCenter(admin, { now: ahora });
    expect(centro.unread).toBe(4);
    expect(await servicio.getUnreadCount(admin, { now: ahora })).toBe(4);
  });

  test('cada aviso lleva su gravedad, título, detalle y destino', async () => {
    const servicio = createNotificationService({ providers: [proveedor('STOCK_OUT', 'STOCK', 1)], model: modeloFalso() });
    const [aviso] = (await servicio.getCenter(admin, { now: ahora })).groups[0].items;
    expect(aviso).toMatchObject({
      key: 'STOCK:1',
      type: 'STOCK_OUT',
      severity: 2,
      title: 'STOCK_OUT 1',
      detail: 'detalle',
      read: false,
      target: { module: 'inventory', id: 1 }
    });
  });
});

describe('limpieza de lecturas', () => {
  test('elimina las lecturas del usuario cuyos avisos ya no aplican y respeta las de otro usuario', async () => {
    const modelo = modeloFalso([
      { userId: 1, key: 'STOCK:1', severity: 1 },
      { userId: 1, key: 'STOCK:99', severity: 1 },
      { userId: 2, key: 'STOCK:99', severity: 1 }
    ]);
    const servicio = createNotificationService({ providers: [proveedor('STOCK_LOW', 'STOCK', 2)], model: modelo });
    await servicio.getCenter(admin, { now: ahora });
    expect(modelo.lecturas.has('1|STOCK:1')).toBe(true);
    expect(modelo.lecturas.has('1|STOCK:99')).toBe(false);
    expect(modelo.lecturas.has('2|STOCK:99')).toBe(true);
  });

  test('con 12 avisos leídos, la limpieza no elimina los que no caben en los 10 mostrados', async () => {
    const lecturas = Array.from({ length: 12 }, (_, i) => ({ userId: 1, key: `STOCK:${i + 1}`, severity: 1 }));
    const modelo = modeloFalso(lecturas);
    const servicio = createNotificationService({ providers: [proveedor('STOCK_LOW', 'STOCK', 12)], model: modelo });
    const centro = await servicio.getCenter(admin, { now: ahora });
    expect(centro.groups[0].total).toBe(12);
    expect(centro.groups[0].unread).toBe(0);
    expect(centro.unread).toBe(0);
    expect(modelo.lecturas.has('1|STOCK:11')).toBe(true);
    expect(modelo.lecturas.has('1|STOCK:12')).toBe(true);
    expect(modelo.lecturas.size).toBe(12);
  });
});

describe('markRead', () => {
  test('guarda la gravedad actual del aviso y devuelve el total de no leídos', async () => {
    const modelo = modeloFalso();
    const servicio = createNotificationService({
      providers: [proveedor('STOCK_OUT', 'STOCK', 2), proveedor('MAINTENANCE_SOON', 'MAINT', 1)],
      model: modelo
    });
    const resultado = await servicio.markRead(admin, 'STOCK:1', { now: ahora });
    expect(modelo.lecturas.get('1|STOCK:1')).toBe(2);
    expect(resultado).toEqual({ key: 'STOCK:1', read: true, unread: 2 });
  });

  test('marcar dos veces el mismo aviso no duplica la lectura', async () => {
    const modelo = modeloFalso();
    const servicio = createNotificationService({ providers: [proveedor('STOCK_LOW', 'STOCK', 1)], model: modelo });
    await servicio.markRead(admin, 'STOCK:1', { now: ahora });
    await servicio.markRead(admin, 'STOCK:1', { now: ahora });
    expect(modelo.lecturas.size).toBe(1);
  });

  test('acepta la clave de un aviso que no está entre los 10 mostrados', async () => {
    const modelo = modeloFalso();
    const servicio = createNotificationService({ providers: [proveedor('STOCK_LOW', 'STOCK', 12)], model: modelo });
    const resultado = await servicio.markRead(admin, 'STOCK:11', { now: ahora });
    expect(resultado.unread).toBe(11);
    expect(modelo.lecturas.has('1|STOCK:11')).toBe(true);
  });

  test('una clave que no existe responde 404 NOTIFICATION_NOT_FOUND', async () => {
    const servicio = createNotificationService({ providers: [proveedor('STOCK_LOW', 'STOCK', 1)], model: modeloFalso() });
    await expect(servicio.markRead(admin, 'STOCK:50', { now: ahora })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOTIFICATION_NOT_FOUND'
    });
  });

  test('una clave mal formada responde 404 NOTIFICATION_NOT_FOUND', async () => {
    const servicio = createNotificationService({ providers: [proveedor('STOCK_LOW', 'STOCK', 1)], model: modeloFalso() });
    await expect(servicio.markRead(admin, 'cualquier cosa', { now: ahora })).rejects.toMatchObject({
      code: 'NOTIFICATION_NOT_FOUND'
    });
  });

  test('un aviso de un tipo que el rol no puede ver responde 404 aunque exista', async () => {
    const modelo = modeloFalso();
    const servicio = createNotificationService({
      providers: [proveedor('STOCK_LOW', 'STOCK', 1), proveedor('ORDER_STALE', 'ORDER', 1)],
      model: modelo
    });
    await expect(servicio.markRead(mecanico, 'STOCK:1', { now: ahora })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOTIFICATION_NOT_FOUND'
    });
    expect(modelo.lecturas.size).toBe(0);
    await expect(servicio.markRead(mecanico, 'ORDER:1', { now: ahora })).resolves.toMatchObject({ read: true });
  });
});

describe('getUnreadCount', () => {
  test('usa solo las claves cuando el proveedor las ofrece, sin armar el detalle', async () => {
    const llamadas = { list: 0, keys: 0 };
    const ligero = {
      type: 'STOCK_LOW',
      async list() {
        llamadas.list += 1;
        return [];
      },
      async keys() {
        llamadas.keys += 1;
        return [{ key: 'STOCK:1' }, { key: 'STOCK:2' }];
      }
    };
    const servicio = createNotificationService({ providers: [ligero], model: modeloFalso() });
    expect(await servicio.getUnreadCount(admin, { now: ahora })).toBe(2);
    expect(llamadas).toEqual({ list: 0, keys: 1 });
  });

  test('descuenta los avisos ya leídos con la misma gravedad', async () => {
    const modelo = modeloFalso([{ userId: 1, key: 'STOCK:1', severity: 1 }]);
    const servicio = createNotificationService({ providers: [proveedor('STOCK_LOW', 'STOCK', 3)], model: modelo });
    expect(await servicio.getUnreadCount(admin, { now: ahora })).toBe(2);
  });
});
