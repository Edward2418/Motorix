import { AppError } from '../../utils/AppError.js';

describe('errores nuevos del Sprint 5', () => {
  test('orderAlreadyPaid responde 409 ORDER_ALREADY_PAID con el mensaje de orden cobrada', () => {
    const error = AppError.orderAlreadyPaid();
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('ORDER_ALREADY_PAID');
    expect(error.message).toBe('La orden ya está cobrada: no se pueden modificar las refacciones.');
  });

  test('orderTotalLimit responde 422 ORDER_TOTAL_LIMIT_EXCEEDED', () => {
    const error = AppError.orderTotalLimit();
    expect(error.statusCode).toBe(422);
    expect(error.code).toBe('ORDER_TOTAL_LIMIT_EXCEEDED');
    expect(error.message).toContain('$99,999,999.99');
  });

  test('priceBelowCost responde 422 PRICE_BELOW_COST con un detalle en el campo salePrice', () => {
    const error = AppError.priceBelowCost();
    expect(error.statusCode).toBe(422);
    expect(error.code).toBe('PRICE_BELOW_COST');
    expect(error.details).toEqual([{ field: 'salePrice', message: expect.stringContaining('menor al de compra') }]);
  });
});
