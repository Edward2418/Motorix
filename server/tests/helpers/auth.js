import request from 'supertest';
import app from '../../app.js';
import { createUser, TEST_PASSWORD } from './db.js';

// Crea un usuario con el rol indicado, inicia sesión y devuelve su token.
export async function loginAs(role, overrides = {}) {
  const user = await createUser({ role, ...overrides });
  const response = await request(app).post('/api/auth/login').send({
    identifier: user.username,
    password: TEST_PASSWORD
  });
  return { token: response.body.data.token, user };
}

export function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}
