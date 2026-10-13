import { resolveStatus } from '../../services/gateways/mercadoPagoStatus.js';

const ahora = new Date('2026-10-13T12:00:00Z');
const vigente = new Date('2026-10-14T12:00:00Z');
const vencido = new Date('2026-10-12T12:00:00Z');

const resolver = (results, expiresAt = vigente) => resolveStatus({ results, now: ahora, expiresAt });

describe('resolveStatus', () => {
  test('un cobro aprobado deja el pago PAGADO con su identificador', () => {
    expect(resolver([{ id: 123456, status: 'approved' }])).toEqual({ status: 'PAGADO', externalPaymentId: '123456', expired: false });
  });

  test('si hay uno aprobado gana aunque otros estén rechazados', () => {
    const resultado = resolver([
      { id: 1, status: 'rejected' },
      { id: 2, status: 'approved' },
      { id: 3, status: 'cancelled' }
    ]);
    expect(resultado).toMatchObject({ status: 'PAGADO', externalPaymentId: '2' });
  });

  test('si todos están rechazados o cancelados el pago queda RECHAZADO', () => {
    expect(resolver([{ id: 1, status: 'rejected' }])).toEqual({ status: 'RECHAZADO', externalPaymentId: null, expired: false });
    expect(resolver([{ id: 1, status: 'rejected' }, { id: 2, status: 'cancelled' }]).status).toBe('RECHAZADO');
  });

  test('los cobros devueltos o contracargados no cuentan como cobrados', () => {
    expect(resolver([{ id: 1, status: 'refunded' }]).status).toBe('RECHAZADO');
    expect(resolver([{ id: 1, status: 'charged_back' }]).status).toBe('RECHAZADO');
  });

  test('pending, in_process, authorized e in_mediation siguen PENDIENTE', () => {
    for (const status of ['pending', 'in_process', 'authorized', 'in_mediation']) {
      expect({ status, resultado: resolver([{ id: 1, status }]).status }).toEqual({ status, resultado: 'PENDIENTE' });
    }
  });

  test('un cobro pendiente junto a uno rechazado sigue PENDIENTE', () => {
    expect(resolver([{ id: 1, status: 'rejected' }, { id: 2, status: 'pending' }]).status).toBe('PENDIENTE');
  });

  test('un estado desconocido se trata como pendiente', () => {
    expect(resolver([{ id: 1, status: 'algo_nuevo' }]).status).toBe('PENDIENTE');
  });

  test('sin cobros y con el enlace vencido queda RECHAZADO por expiración', () => {
    expect(resolver([], vencido)).toEqual({ status: 'RECHAZADO', externalPaymentId: null, expired: true });
  });

  test('sin cobros y con el enlace vigente sigue PENDIENTE', () => {
    expect(resolver([], vigente)).toEqual({ status: 'PENDIENTE', externalPaymentId: null, expired: false });
  });

  test('un cobro aprobado cuenta aunque el enlace ya haya vencido', () => {
    expect(resolver([{ id: 9, status: 'approved' }], vencido).status).toBe('PAGADO');
  });

  test('un cobro pendiente con el enlace vencido sigue PENDIENTE', () => {
    expect(resolver([{ id: 9, status: 'in_process' }], vencido).status).toBe('PENDIENTE');
  });
});
