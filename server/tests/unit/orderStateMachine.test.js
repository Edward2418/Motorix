import {
  ORDER_STATUSES,
  allowedTransitions,
  canTransition,
  isFinalStatus,
  isOpenStatus
} from '../../services/orderStateMachine.js';

// Transiciones válidas del flujo (sin importar el rol), según research.md punto 2.
const VALID = {
  RECIBIDO: ['DIAGNOSTICO', 'CANCELADA'],
  DIAGNOSTICO: ['EN_REPARACION', 'CANCELADA'],
  EN_REPARACION: ['ESPERANDO_REFACCION', 'TERMINADO', 'CANCELADA'],
  ESPERANDO_REFACCION: ['EN_REPARACION', 'CANCELADA'],
  TERMINADO: ['ENTREGADO'],
  ENTREGADO: [],
  CANCELADA: []
};

// Destinos que un mecánico asignado puede aplicar (nunca ENTREGADO ni CANCELADA).
const MECHANIC_TARGETS = ['DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION', 'TERMINADO'];

const check = (from, to, role, isAssignedMechanic = false) => canTransition({ from, to, role, isAssignedMechanic });

describe('máquina de estados de la orden: estados', () => {
  test('define los siete estados esperados', () => {
    expect([...ORDER_STATUSES].sort()).toEqual(
      ['CANCELADA', 'DIAGNOSTICO', 'EN_REPARACION', 'ENTREGADO', 'ESPERANDO_REFACCION', 'RECIBIDO', 'TERMINADO'].sort()
    );
  });

  test('ENTREGADO y CANCELADA son finales; los demás estados están abiertos o terminados', () => {
    expect(isFinalStatus('ENTREGADO')).toBe(true);
    expect(isFinalStatus('CANCELADA')).toBe(true);
    expect(isFinalStatus('TERMINADO')).toBe(false);
    expect(isOpenStatus('ENTREGADO')).toBe(false);
    expect(isOpenStatus('CANCELADA')).toBe(false);
    expect(isOpenStatus('TERMINADO')).toBe(true);
    expect(isOpenStatus('RECIBIDO')).toBe(true);
  });
});

describe('máquina de estados de la orden: administración y recepción', () => {
  for (const role of ['ADMIN', 'RECEPTIONIST']) {
    test(`${role} puede hacer exactamente las transiciones válidas y ninguna otra`, () => {
      for (const from of ORDER_STATUSES) {
        for (const to of ORDER_STATUSES) {
          const result = check(from, to, role);
          const esperado = VALID[from].includes(to);
          expect({ from, to, ok: result.ok }).toEqual({ from, to, ok: esperado });
          if (!esperado) {
            expect(result.code).toBe('INVALID_TRANSITION');
          }
        }
      }
    });
  }

  test('el recorrido feliz completo es válido', () => {
    const camino = ['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION', 'EN_REPARACION', 'TERMINADO', 'ENTREGADO'];
    for (let i = 0; i < camino.length - 1; i++) {
      expect(check(camino[i], camino[i + 1], 'RECEPTIONIST').ok).toBe(true);
    }
  });

  test('no se puede saltar ni retroceder', () => {
    expect(check('RECIBIDO', 'EN_REPARACION', 'ADMIN').ok).toBe(false);
    expect(check('DIAGNOSTICO', 'TERMINADO', 'ADMIN').ok).toBe(false);
    expect(check('EN_REPARACION', 'DIAGNOSTICO', 'ADMIN').ok).toBe(false);
    expect(check('TERMINADO', 'EN_REPARACION', 'ADMIN').ok).toBe(false);
    expect(check('ENTREGADO', 'TERMINADO', 'ADMIN').ok).toBe(false);
  });

  test('un estado no se puede repetir', () => {
    for (const status of ORDER_STATUSES) {
      expect(check(status, status, 'ADMIN').ok).toBe(false);
    }
  });

  test('ESPERANDO_REFACCION solo se alcanza desde EN_REPARACION y solo regresa a EN_REPARACION (o se cancela)', () => {
    for (const from of ORDER_STATUSES) {
      expect(check(from, 'ESPERANDO_REFACCION', 'ADMIN').ok).toBe(from === 'EN_REPARACION');
    }
    expect(check('ESPERANDO_REFACCION', 'TERMINADO', 'ADMIN').ok).toBe(false);
  });

  test('TERMINADO solo avanza a ENTREGADO y no se puede cancelar', () => {
    expect(check('TERMINADO', 'ENTREGADO', 'RECEPTIONIST').ok).toBe(true);
    expect(check('TERMINADO', 'CANCELADA', 'ADMIN').ok).toBe(false);
  });

  test('ENTREGADO y CANCELADA no tienen salidas', () => {
    for (const to of ORDER_STATUSES) {
      expect(check('ENTREGADO', to, 'ADMIN').ok).toBe(false);
      expect(check('CANCELADA', to, 'ADMIN').ok).toBe(false);
    }
  });
});

describe('máquina de estados de la orden: mecánico asignado', () => {
  test('puede aplicar las transiciones válidas hacia sus destinos y ninguna otra', () => {
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        const result = check(from, to, 'MECHANIC', true);
        const esperado = VALID[from].includes(to) && MECHANIC_TARGETS.includes(to);
        expect({ from, to, ok: result.ok }).toEqual({ from, to, ok: esperado });
      }
    }
  });

  test('nunca puede marcar ENTREGADO ni cancelar, aunque la transición sea válida (403)', () => {
    const entregar = check('TERMINADO', 'ENTREGADO', 'MECHANIC', true);
    expect(entregar.ok).toBe(false);
    expect(entregar.code).toBe('FORBIDDEN');

    for (const from of ['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION']) {
      const cancelar = check(from, 'CANCELADA', 'MECHANIC', true);
      expect(cancelar.ok).toBe(false);
      expect(cancelar.code).toBe('FORBIDDEN');
    }
  });

  test('una transición inválida se informa como tal (409), no como falta de permiso', () => {
    const result = check('DIAGNOSTICO', 'TERMINADO', 'MECHANIC', true);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('INVALID_TRANSITION');
  });

  test('puede llegar hasta TERMINADO pasando por ESPERANDO_REFACCION', () => {
    expect(check('RECIBIDO', 'DIAGNOSTICO', 'MECHANIC', true).ok).toBe(true);
    expect(check('DIAGNOSTICO', 'EN_REPARACION', 'MECHANIC', true).ok).toBe(true);
    expect(check('EN_REPARACION', 'ESPERANDO_REFACCION', 'MECHANIC', true).ok).toBe(true);
    expect(check('ESPERANDO_REFACCION', 'EN_REPARACION', 'MECHANIC', true).ok).toBe(true);
    expect(check('EN_REPARACION', 'TERMINADO', 'MECHANIC', true).ok).toBe(true);
  });
});

describe('máquina de estados de la orden: mecánico no asignado', () => {
  test('no puede hacer ninguna transición, ni siquiera las válidas (403)', () => {
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        const result = check(from, to, 'MECHANIC', false);
        expect(result.ok).toBe(false);
        expect(result.code).toBe('FORBIDDEN');
      }
    }
  });
});

describe('máquina de estados de la orden: transiciones permitidas para la interfaz', () => {
  test('administración y recepción ven todas las salidas válidas', () => {
    expect(allowedTransitions({ from: 'EN_REPARACION', role: 'ADMIN', isAssignedMechanic: false }).sort()).toEqual(
      ['CANCELADA', 'ESPERANDO_REFACCION', 'TERMINADO']
    );
    expect(allowedTransitions({ from: 'TERMINADO', role: 'RECEPTIONIST', isAssignedMechanic: false })).toEqual(['ENTREGADO']);
  });

  test('el mecánico asignado solo ve sus destinos y el no asignado no ve ninguno', () => {
    expect(allowedTransitions({ from: 'EN_REPARACION', role: 'MECHANIC', isAssignedMechanic: true }).sort()).toEqual(
      ['ESPERANDO_REFACCION', 'TERMINADO']
    );
    expect(allowedTransitions({ from: 'TERMINADO', role: 'MECHANIC', isAssignedMechanic: true })).toEqual([]);
    expect(allowedTransitions({ from: 'RECIBIDO', role: 'MECHANIC', isAssignedMechanic: false })).toEqual([]);
  });

  test('los estados finales no tienen transiciones', () => {
    expect(allowedTransitions({ from: 'ENTREGADO', role: 'ADMIN', isAssignedMechanic: false })).toEqual([]);
    expect(allowedTransitions({ from: 'CANCELADA', role: 'ADMIN', isAssignedMechanic: false })).toEqual([]);
  });
});

describe('máquina de estados de la orden: mensajes', () => {
  test('el rechazo por transición inválida indica los estados permitidos', () => {
    const result = check('DIAGNOSTICO', 'TERMINADO', 'ADMIN');
    expect(result.reason).toMatch(/EN_REPARACION/);
  });

  test('el rechazo desde un estado final lo explica', () => {
    const result = check('ENTREGADO', 'TERMINADO', 'ADMIN');
    expect(result.reason).toMatch(/ENTREGADO/);
    expect(result.reason).toMatch(/no admite más cambios|final/i);
  });
});
