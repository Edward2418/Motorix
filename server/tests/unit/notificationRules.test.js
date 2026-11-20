import {
  NOTIFICATION_TYPES,
  STALE_AFTER_DAYS,
  buildKey,
  isStaleOrder,
  parseKey,
  severityOf,
  visibleTypes
} from '../../services/notificationRules.js';

const DIA = 86400000;
const ahora = new Date('2026-11-18T12:00:00Z');
const haceDias = (dias, extraMs = 0) => new Date(ahora.getTime() - dias * DIA - extraMs);

describe('tipos de aviso y gravedad', () => {
  test('los seis tipos existen', () => {
    expect([...NOTIFICATION_TYPES].sort()).toEqual(
      [
        'APPOINTMENT_TODAY',
        'MAINTENANCE_OVERDUE',
        'MAINTENANCE_SOON',
        'ORDER_STALE',
        'STOCK_LOW',
        'STOCK_OUT'
      ].sort()
    );
  });

  test.each(['MAINTENANCE_SOON', 'STOCK_LOW', 'APPOINTMENT_TODAY', 'ORDER_STALE'])('%s tiene gravedad 1', (tipo) => {
    expect(severityOf(tipo)).toBe(1);
  });

  test.each(['MAINTENANCE_OVERDUE', 'STOCK_OUT'])('%s tiene gravedad 2', (tipo) => {
    expect(severityOf(tipo)).toBe(2);
  });

  test('un tipo desconocido no tiene gravedad', () => {
    expect(() => severityOf('OTRO')).toThrow();
  });
});

describe('visibilidad por rol', () => {
  test('ADMIN ve los seis tipos', () => {
    expect([...visibleTypes('ADMIN')].sort()).toEqual([...NOTIFICATION_TYPES].sort());
  });

  test('RECEPTIONIST ve mantenimientos, citas y órdenes detenidas, y nunca stock', () => {
    const tipos = visibleTypes('RECEPTIONIST');
    expect([...tipos].sort()).toEqual(
      ['APPOINTMENT_TODAY', 'MAINTENANCE_OVERDUE', 'MAINTENANCE_SOON', 'ORDER_STALE'].sort()
    );
    expect(tipos).not.toContain('STOCK_LOW');
    expect(tipos).not.toContain('STOCK_OUT');
  });

  test('MECHANIC ve solo órdenes detenidas', () => {
    expect(visibleTypes('MECHANIC')).toEqual(['ORDER_STALE']);
  });

  test('un rol desconocido no ve ningún tipo', () => {
    expect(visibleTypes('INVITADO')).toEqual([]);
    expect(visibleTypes(undefined)).toEqual([]);
  });

  test('modificar el resultado no altera la matriz de roles', () => {
    const tipos = visibleTypes('MECHANIC');
    tipos.push('STOCK_OUT');
    expect(visibleTypes('MECHANIC')).toEqual(['ORDER_STALE']);
  });
});

describe('claves de aviso', () => {
  test('buildKey arma TIPO:id', () => {
    expect(buildKey('STOCK', 3)).toBe('STOCK:3');
    expect(buildKey('MAINT', 12)).toBe('MAINT:12');
  });

  test('buildKey rechaza un prefijo o un id inválidos', () => {
    expect(() => buildKey('OTRO', 1)).toThrow();
    expect(() => buildKey('STOCK', 0)).toThrow();
    expect(() => buildKey('STOCK', 1.5)).toThrow();
  });

  test.each(['MAINT:1', 'APPT:7', 'STOCK:3', 'ORDER:41'])('parseKey acepta %s', (clave) => {
    const resultado = parseKey(clave);
    expect(resultado).not.toBeNull();
    expect(`${resultado.prefix}:${resultado.id}`).toBe(clave);
    expect(Number.isInteger(resultado.id)).toBe(true);
  });

  test.each(['', 'STOCK', 'STOCK:', 'STOCK:abc', 'stock:3', 'OTRO:3', 'STOCK:3:4', ' STOCK:3', 'STOCK:-3', 'STOCK:3.5'])(
    'parseKey rechaza %p',
    (clave) => {
      expect(parseKey(clave)).toBeNull();
    }
  );

  test('parseKey rechaza lo que no es texto y las claves de más de 60 caracteres', () => {
    expect(parseKey(null)).toBeNull();
    expect(parseKey(12)).toBeNull();
    expect(parseKey(`STOCK:${'9'.repeat(60)}`)).toBeNull();
  });
});

describe('orden detenida (isStaleOrder)', () => {
  test('el plazo es de 3 días', () => {
    expect(STALE_AFTER_DAYS).toBe(3);
  });

  test.each(['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION'])(
    '%s con último cambio hace 5 días está detenida',
    (status) => {
      expect(isStaleOrder({ status, lastChangeAt: haceDias(5), now: ahora })).toBe(true);
    }
  );

  test('a exactamente 3 días no está detenida', () => {
    expect(isStaleOrder({ status: 'DIAGNOSTICO', lastChangeAt: haceDias(3), now: ahora })).toBe(false);
  });

  test('a 3 días y un milisegundo sí está detenida', () => {
    expect(isStaleOrder({ status: 'DIAGNOSTICO', lastChangeAt: haceDias(3, 1), now: ahora })).toBe(true);
  });

  test('a 2 días no está detenida', () => {
    expect(isStaleOrder({ status: 'EN_REPARACION', lastChangeAt: haceDias(2), now: ahora })).toBe(false);
  });

  test.each(['TERMINADO', 'ENTREGADO', 'CANCELADA'])('%s nunca está detenida, por antigua que sea', (status) => {
    expect(isStaleOrder({ status, lastChangeAt: haceDias(30), now: ahora })).toBe(false);
  });

  test('un estado desconocido no está detenido', () => {
    expect(isStaleOrder({ status: 'OTRO', lastChangeAt: haceDias(30), now: ahora })).toBe(false);
  });

  test('acepta la fecha como texto ISO', () => {
    expect(isStaleOrder({ status: 'RECIBIDO', lastChangeAt: haceDias(5).toISOString(), now: ahora })).toBe(true);
  });
});
