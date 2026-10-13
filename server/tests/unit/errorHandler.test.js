import { jest } from '@jest/globals';
import { errorHandler } from '../../middlewares/errorHandler.js';
import { AppError } from '../../utils/AppError.js';

function respond(error) {
  const res = {
    statusCode: undefined,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
  errorHandler(error, { method: 'GET', originalUrl: '/api/prueba' }, res, () => {});
  return res;
}

describe('manejador central de errores', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('devuelve el mensaje y el código de un error controlado', () => {
    const res = respond(AppError.conflict('Ya existe ese dato.'));
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: { code: 'CONFLICT', message: 'Ya existe ese dato.' } });
  });

  test('un error inesperado devuelve 500 sin trazas ni detalles internos', () => {
    const res = respond(new Error('SELECT * FROM users falló en la línea 42'));
    expect(res.statusCode).toBe(500);
    const texto = JSON.stringify(res.body);
    expect(texto).not.toContain('SELECT');
    expect(texto).not.toContain('stack');
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });

  test('una caída de la base de datos devuelve 503 con un mensaje claro', () => {
    const error = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3306'), { code: 'ECONNREFUSED' });
    const res = respond(error);
    expect(res.statusCode).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toContain('127.0.0.1');
  });

  test('un duplicado de MySQL se traduce a 409', () => {
    const res = respond(Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' }));
    expect(res.statusCode).toBe(409);
  });
});
