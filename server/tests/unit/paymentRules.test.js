import { toCents, fromCents, summarize, canRegister, PAYABLE_STATUSES } from '../../services/paymentRules.js';

const pago = (amount, status = 'PAGADO') => ({ amount, status });

describe('toCents y fromCents', () => {
  test('convierten sin errores de redondeo', () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(1234.56)).toBe(123456);
    expect(toCents('99.99')).toBe(9999);
    expect(toCents(99999999.99)).toBe(9999999999);
    expect(fromCents(123456)).toBe(1234.56);
    expect(fromCents(0)).toBe(0);
  });

  test('el viaje de ida y vuelta conserva el importe con dos decimales', () => {
    for (const valor of [0.01, 0.07, 19.99, 1000.1, 4770, 12345678.9]) {
      expect(fromCents(toCents(valor))).toBe(valor);
    }
  });
});

describe('summarize', () => {
  test('una orden sin pagos está SIN_PAGO y todo el total está disponible', () => {
    expect(summarize({ total: 1000, payments: [] })).toEqual({
      total: 1000,
      collected: 0,
      reserved: 0,
      balance: 1000,
      available: 1000,
      creditBalance: 0,
      status: 'SIN_PAGO'
    });
  });

  test('un pago parcial deja la orden en PARCIAL con el saldo y lo disponible', () => {
    const resumen = summarize({ total: 1000, payments: [pago(400)] });
    expect(resumen).toMatchObject({ collected: 400, balance: 600, available: 600, status: 'PARCIAL' });
  });

  test('cobrar exactamente el total deja la orden PAGADA con saldo cero', () => {
    const resumen = summarize({ total: 1000, payments: [pago(400), pago(600)] });
    expect(resumen).toMatchObject({ collected: 1000, balance: 0, available: 0, creditBalance: 0, status: 'PAGADA' });
  });

  test('los pagos pendientes reservan importe sin contar como cobrado', () => {
    const resumen = summarize({ total: 1000, payments: [pago(300), pago(500, 'PENDIENTE')] });
    expect(resumen).toMatchObject({ collected: 300, reserved: 500, balance: 700, available: 200, status: 'PARCIAL' });
  });

  test('un pago pendiente solo no cambia el estado de pago de la orden', () => {
    const resumen = summarize({ total: 1000, payments: [pago(1000, 'PENDIENTE')] });
    expect(resumen).toMatchObject({ collected: 0, reserved: 1000, available: 0, status: 'SIN_PAGO' });
  });

  test('los pagos rechazados y cancelados no cuentan', () => {
    const resumen = summarize({ total: 1000, payments: [pago(1000, 'RECHAZADO'), pago(500, 'CANCELADO'), pago(100)] });
    expect(resumen).toMatchObject({ collected: 100, reserved: 0, available: 900, status: 'PARCIAL' });
  });

  test('un total en cero nunca está PAGADA', () => {
    expect(summarize({ total: 0, payments: [] })).toMatchObject({ status: 'SIN_PAGO', balance: 0, available: 0 });
    expect(summarize({ total: 0, payments: [pago(50)] }).status).not.toBe('PAGADA');
  });

  test('si el total baja después de cobrar aparece el saldo a favor y no queda nada disponible', () => {
    const resumen = summarize({ total: 800, payments: [pago(1000)] });
    expect(resumen).toMatchObject({ collected: 1000, balance: 0, available: 0, creditBalance: 200, status: 'PAGADA' });
  });

  test('suma sin errores de redondeo con importes de centavos', () => {
    const resumen = summarize({ total: 0.3, payments: [pago(0.1), pago(0.2)] });
    expect(resumen).toMatchObject({ collected: 0.3, balance: 0, status: 'PAGADA' });
  });

  test('acepta importes como texto, tal como los devuelve el controlador de la base', () => {
    const resumen = summarize({ total: '1500.50', payments: [pago('500.25')] });
    expect(resumen).toMatchObject({ total: 1500.5, collected: 500.25, balance: 1000.25 });
  });
});

describe('canRegister', () => {
  const resumenCon = (total, payments = []) => summarize({ total, payments });

  test('solo se cobran las órdenes TERMINADO y ENTREGADO', () => {
    expect(PAYABLE_STATUSES).toEqual(['TERMINADO', 'ENTREGADO']);
    for (const orderStatus of ['TERMINADO', 'ENTREGADO']) {
      expect(canRegister({ orderStatus, summary: resumenCon(1000), amount: 100 })).toEqual({ ok: true });
    }
  });

  test('rechaza una orden abierta o cancelada con ORDER_NOT_PAYABLE', () => {
    for (const orderStatus of ['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION', 'CANCELADA']) {
      const resultado = canRegister({ orderStatus, summary: resumenCon(1000), amount: 100 });
      expect({ orderStatus, ok: resultado.ok, code: resultado.code }).toEqual({ orderStatus, ok: false, code: 'ORDER_NOT_PAYABLE' });
    }
  });

  test('rechaza una orden sin importe por cobrar', () => {
    const resultado = canRegister({ orderStatus: 'TERMINADO', summary: resumenCon(0), amount: 100 });
    expect(resultado).toMatchObject({ ok: false, code: 'ORDER_NOT_PAYABLE' });
    expect(resultado.reason).toMatch(/no tiene importe por cobrar/i);
  });

  test('rechaza un importe mayor al disponible e informa cuánto hay', () => {
    const resumen = resumenCon(1000, [pago(300), pago(200, 'PENDIENTE')]);
    const resultado = canRegister({ orderStatus: 'TERMINADO', summary: resumen, amount: 600 });
    expect(resultado).toMatchObject({ ok: false, code: 'AMOUNT_EXCEEDS_BALANCE', available: 500 });
    expect(canRegister({ orderStatus: 'TERMINADO', summary: resumen, amount: 500 })).toEqual({ ok: true });
  });

  test('con la orden ya pagada no admite más pagos', () => {
    const resumen = resumenCon(1000, [pago(1000)]);
    expect(canRegister({ orderStatus: 'ENTREGADO', summary: resumen, amount: 0.01 })).toMatchObject({
      ok: false,
      code: 'AMOUNT_EXCEEDS_BALANCE',
      available: 0
    });
  });
});
