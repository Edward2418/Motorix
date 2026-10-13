import * as userModel from '../models/userModel.js';
import { toUser } from '../models/userModel.js';
import { comparePassword, hashPassword } from '../utils/hash.js';
import { decodeExpiresIn, signToken } from '../utils/jwt.js';
import { AppError } from '../utils/AppError.js';

const INVALID_CREDENTIALS = 'Credenciales incorrectas.';

// Inicia sesión con usuario o correo. Usa el mismo mensaje para usuario inexistente,
// contraseña incorrecta o cuenta desactivada, para no revelar qué cuentas existen.
export async function login({ identifier, password }) {
  const row = await userModel.findAuthByIdentifier(identifier);
  const valid = row && row.active && (await comparePassword(password, row.password_hash));
  if (!valid) {
    throw AppError.unauthenticated(INVALID_CREDENTIALS);
  }
  const token = signToken({ sub: row.id, role: row.role });
  return { token, expiresIn: decodeExpiresIn(token), user: toUser(row) };
}

export async function getCurrentUser(id) {
  const user = await userModel.findById(id);
  if (!user) {
    throw AppError.unauthenticated();
  }
  return user;
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const row = await userModel.findAuthById(userId);
  if (!row) {
    throw AppError.unauthenticated();
  }
  if (!(await comparePassword(currentPassword, row.password_hash))) {
    throw AppError.validation('La contraseña actual es incorrecta.', [
      { field: 'currentPassword', message: 'La contraseña actual es incorrecta.' }
    ]);
  }
  await userModel.updatePassword(userId, await hashPassword(newPassword));
}
