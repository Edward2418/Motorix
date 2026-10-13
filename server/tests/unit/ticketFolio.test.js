import { formatTicketFolio } from '../../services/ticketFolio.js';

describe('formatTicketFolio', () => {
  test('da el formato TK-AAAA-NNNN con ceros a la izquierda', () => {
    expect(formatTicketFolio(2026, 1)).toBe('TK-2026-0001');
    expect(formatTicketFolio(2026, 42)).toBe('TK-2026-0042');
    expect(formatTicketFolio(2027, 9999)).toBe('TK-2027-9999');
  });

  test('no trunca el consecutivo al pasar de 9999', () => {
    expect(formatTicketFolio(2026, 10000)).toBe('TK-2026-10000');
    expect(formatTicketFolio(2026, 123456)).toBe('TK-2026-123456');
  });
});
