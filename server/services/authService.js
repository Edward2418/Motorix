import * as userModel from '../models/userModel.js';
import * as loginGuard from './loginGuard.js';
import { toUser } from '../models/userModel.js';
import { comparePassword, hashPassword } from '../utils/hash.js';
import { decodeExpiresIn, sessionStamp, signToken } from '../utils/jwt.js';
import { AppError } from '../utils/AppError.js';
import { auditService } from './auditService.js';
import * as termsService from './termsService.js';

const INVALID_CREDENTIALS = 'Credenciales incorrectas.';

// Un token queda ligado a la contraseña con la que se emitió: al cambiarla, los anteriores dejan de servir.
const tokenFor = (row) => signToken({ sub: row.id, role: row.role, pv: sessionStamp(row.password_hash) });

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
    await auditService.record({ ...who, action: 'ACCOUNT_LOCKED', detail: `bloqueo de ${loginGuard.LOCK_MINUTES} minutos` });
  }
}

// Inicia sesión con usuario o correo. Usa el mismo mensaje para usuario inexistente,
// contraseña incorrecta o cuenta desactivada, para no revelar qué cuentas existen.
// El intento se cuenta antes de comprobar la contraseña (ver loginGuard): 5 fallos desde un origen bloquean la cuenta
// para ese origen durante 15 minutos, también con la contraseña correcta.
export async function login({ identifier, password }, ip) {
  const row = await userModel.findAuthByIdentifier(identifier);
  const attempt = await loginGuard.reserve(row, identifier, ip);
  if (!attempt.allowed) {
    throw AppError.tooManyAttempts(lockedMessage(attempt.lockedUntil));
  }

  const valid = row && row.active && (await comparePassword(password, row.password_hash));
  if (!valid) {
    await auditFailure(row, attempt.locksAccount);
    throw AppError.unauthenticated(INVALID_CREDENTIALS);
  }

  await loginGuard.release(attempt);
  const token = tokenFor(row);
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
  const passwordHash = await hashPassword(newPassword);
  await userModel.updatePassword(userId, passwordHash);
  // Token nuevo para que quien hizo el cambio siga con su sesión; todos los anteriores quedan invalidados.
  return tokenFor({ ...row, password_hash: passwordHash });
}
