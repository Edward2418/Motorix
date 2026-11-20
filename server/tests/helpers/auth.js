import request from 'supertest';
import app from '../../app.js';
import { createUser, acceptTerms, TEST_PASSWORD } from './db.js';

// Crea un usuario con el rol indicado, inicia sesión y devuelve su token. Si ya hay una versión de los términos
// publicada (por ejemplo, porque se cargaron los seeds), registra su aceptación antes de iniciar sesión: así las pruebas
// que no tratan de los términos no quedan bloqueadas por el filtro de aceptación (Sprint 7). Con `aceptarTerminos: false`
// el usuario queda sin aceptar, para probar justamente ese bloqueo.
export async function loginAs(role, { aceptarTerminos = true, ...overrides } = {}) {
  const user = await createUser({ role, ...overrides });
  if (aceptarTerminos) {
    await acceptTerms(user.id);
  }
  const response = await request(app).post('/api/auth/login').send({
    identifier: user.username,
    password: TEST_PASSWORD
  });
  return { token: response.body.data.token, user };
}

export function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}
