import { AppError } from '../../utils/AppError.js';

describe('errores nuevos del Sprint 6', () => {
  test('notificationNotFound responde 404 NOTIFICATION_NOT_FOUND', () => {
    const error = AppError.notificationNotFound();
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOTIFICATION_NOT_FOUND');
    expect(error.message).toBe('El aviso no existe o no te corresponde.');
  });

  test('noticeAlreadyRegistered responde 409 NOTICE_ALREADY_REGISTERED', () => {
    const error = AppError.noticeAlreadyRegistered();
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('NOTICE_ALREADY_REGISTERED');
    expect(error.message).toBe('Ese hecho ya se avisó al cliente.');
  });

  test('noticeNotApplicable responde 409 NOTICE_NOT_APPLICABLE', () => {
    const error = AppError.noticeNotApplicable();
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('NOTICE_NOT_APPLICABLE');
    expect(error.message).toBe('Ese hecho ya no está vigente.');
  });
});
