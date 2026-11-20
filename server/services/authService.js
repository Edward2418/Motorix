import * as userModel from '../models/userModel.js';
import * as loginAttemptModel from '../models/loginAttemptModel.js';
import { toUser } from '../models/userModel.js';
import { comparePassword, hashPassword } from '../utils/hash.js';
import { decodeExpiresIn, signToken } from '../utils/jwt.js';
import { AppError } from '../utils/AppError.js';
import { auditService } from './auditService.js';
import * as termsService from './termsService.js';

const INVALID_CREDENTIALS = 'Credenciales incorrectas.';

// Bloqueo por intentos fallidos consecutivos (project-context.md §27).
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

// Clave de intentos: por cuenta si existe (aunque se alterne entre usuario y correo) y por texto si no existe,
// de modo que el comportamiento es el mismo y no revela qué cuentas existen.
function attemptKey(row, identifier) {
  return row ? `u:${row.id}` : `i:${identifier.trim().toLowerCase()}`;
}

function lockedMessage(lockedUntil) {
  const minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60000));
  return `Demasiados intentos fallidos. Inténtalo de nuevo en ${minutes} minuto${minutes === 1 ? '' : 's'}.`;
}

// Registra en la bitácora un inicio fallido y, si con él se alcanza el límite, el bloqueo de la cuenta. Con una cuenta
// inexistente no se guarda el texto escrito (podría ser una contraseña), solo que hubo un intento fallido.
async function auditFailure(row, locked) {
  const who = row
    ? { userId: row.id, actor: row.username, entity: 'USER', entityId: row.id }
    : { userId: null, actor: null, entity: null, entityId: null };
  await auditService.record({ ...who, action: 'LOGIN_FAILED' });
  if (locked) {
    await auditService.record({ ...who, action: 'ACCOUNT_LOCKED', detail: `bloqueo de ${LOCK_MINUTES} minutos` });
  }
}

async function registerFailure(key, row) {
  const previous = await loginAttemptModel.get(key);
  const lockExpired = previous?.lockedUntil && previous.lockedUntil.getTime() <= Date.now();
  const count = (previous && !lockExpired ? previous.failedCount : 0) + 1;
  // Se trunca a segundos porque DATETIME no guarda fracciones y MySQL redondearía hacia arriba.
  const lockedUntil =
    count >= MAX_FAILED_ATTEMPTS
      ? new Date(Math.floor((Date.now() + LOCK_MINUTES * 60000) / 1000) * 1000)
      : null;
  await loginAttemptModel.save(key, count, lockedUntil);
  await auditFailure(row, lockedUntil !== null);
}

// Inicia sesión con usuario o correo. Usa el mismo mensaje para usuario inexistente,
// contraseña incorrecta o cuenta desactivada, para no revelar qué cuentas existen.
// Tras 5 fallos consecutivos bloquea la cuenta 15 minutos (también con la contraseña correcta).
export async function login({ identifier, password }) {
  const row = await userModel.findAuthByIdentifier(identifier);
  const key = attemptKey(row, identifier);

  const attempt = await loginAttemptModel.get(key);
  if (attempt?.lockedUntil && attempt.lockedUntil.getTime() > Date.now()) {
    throw AppError.tooManyAttempts(lockedMessage(attempt.lockedUntil));
  }

  const valid = row && row.active && (await comparePassword(password, row.password_hash));
  if (!valid) {
    await registerFailure(key, row);
    throw AppError.unauthenticated(INVALID_CREDENTIALS);
  }

  if (attempt) {
    await loginAttemptModel.reset(key);
  }
  const token = signToken({ sub: row.id, role: row.role });
  // `termsAccepted: false` indica al cliente que debe mostrar los términos antes de cualquier módulo.
  const termsAccepted = await termsService.hasAcceptedCurrent(row.id);
  return { token, expiresIn: decodeExpiresIn(token), user: toUser(row), termsAccepted };
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
