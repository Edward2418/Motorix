import { authorize } from '../../middlewares/authorize.js';

function run(middleware, user) {
  let received;
  middleware({ user }, {}, (error) => {
    received = error;
  });
  return received;
}

describe('middleware authorize', () => {
  test('permite el paso a un rol autorizado', () => {
    expect(run(authorize('ADMIN', 'RECEPTIONIST'), { role: 'RECEPTIONIST' })).toBeUndefined();
  });

  test('responde 403 a un rol no autorizado', () => {
    const error = run(authorize('ADMIN'), { role: 'MECHANIC' });
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
  });

  test('responde 401 si no hay usuario autenticado', () => {
    const error = run(authorize('ADMIN'), undefined);
    expect(error.statusCode).toBe(401);
  });
});
