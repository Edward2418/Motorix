import { assertWithinLimit, MAX_ORDER_TOTAL_CENTS } from '../../services/orderTotalRules.js';
import { AppError } from '../../utils/AppError.js';

describe('assertWithinLimit', () => {
  test('el máximo del total son 99,999,999.99 pesos en centavos exactos', () => {
    expect(MAX_ORDER_TOTAL_CENTS).toBe(9999999999);
  });

  test('acepta un total que llega exactamente al máximo', () => {
    expect(() => assertWithinLimit(9999999000, 999)).not.toThrow();
    expect(() => assertWithinLimit(0, 9999999999)).not.toThrow();
  });

  test('rechaza un total que supera el máximo por un solo centavo', () => {
    expect(() => assertWithinLimit(9999999000, 1000)).toThrow(AppError);
    try {
      assertWithinLimit(9999999000, 1000);
    } catch (error) {
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('ORDER_TOTAL_LIMIT_EXCEEDED');
    }
  });

  test('un cambio que no aumenta el total nunca se rechaza', () => {
    expect(() => assertWithinLimit(5000, 0)).not.toThrow();
    expect(() => assertWithinLimit(5000, -2000)).not.toThrow();
  });
});
