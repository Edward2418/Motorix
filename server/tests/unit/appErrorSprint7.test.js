import { AppError } from '../../utils/AppError.js';

describe('errores nuevos del Sprint 7', () => {
  test('termsNotAccepted responde 403 TERMS_NOT_ACCEPTED', () => {
    const error = AppError.termsNotAccepted();
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('TERMS_NOT_ACCEPTED');
    expect(error.message).toBe('Debes aceptar los términos y condiciones vigentes para continuar.');
  });

  test('termsVersionOutdated responde 409 TERMS_VERSION_OUTDATED', () => {
    const error = AppError.termsVersionOutdated();
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('TERMS_VERSION_OUTDATED');
    expect(error.message).toBe('Esa versión de los términos ya no es la vigente. Vuelve a abrirlos para leer la nueva.');
  });

  test('serviceTypeDuplicate responde 409 SERVICE_TYPE_DUPLICATE', () => {
    const error = AppError.serviceTypeDuplicate();
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('SERVICE_TYPE_DUPLICATE');
    expect(error.message).toBe('Ya existe un tipo de servicio con ese nombre.');
  });

  test('reportRangeInvalid responde 400 REPORT_RANGE_INVALID con el motivo recibido', () => {
    const error = AppError.reportRangeInvalid('El rango no puede pasar de 366 días.');
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('REPORT_RANGE_INVALID');
    expect(error.message).toBe('El rango no puede pasar de 366 días.');
  });

  test('reportRangeInvalid tiene un mensaje por defecto en español', () => {
    expect(AppError.reportRangeInvalid().message).toBe('El rango de fechas del reporte no es válido.');
  });
});
