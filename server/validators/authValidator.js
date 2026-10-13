import { FieldErrors, requireBody } from './common.js';

// Política mínima de contraseñas: 8 caracteres, una mayúscula, una minúscula y un número.
// Se limita a 72 bytes porque bcrypt ignora el resto.
export function passwordProblems(password) {
  const problems = [];
  if (password.length < 8) {
    problems.push('Debe tener al menos 8 caracteres.');
  }
  if (!/[A-ZÁÉÍÓÚÑÜ]/.test(password)) {
    problems.push('Debe incluir al menos una letra mayúscula.');
  }
  if (!/[a-záéíóúñü]/.test(password)) {
    problems.push('Debe incluir al menos una letra minúscula.');
  }
  if (!/\d/.test(password)) {
    problems.push('Debe incluir al menos un número.');
  }
  if (Buffer.byteLength(password, 'utf8') > 72) {
    problems.push('No puede superar los 72 bytes.');
  }
  return problems;
}

// Valida una contraseña nueva y registra un error por cada requisito incumplido.
export function checkNewPassword(errors, value, field = 'newPassword') {
  if (typeof value !== 'string' || value.length === 0) {
    errors.add(field, 'La contraseña es obligatoria.');
    return undefined;
  }
  const problems = passwordProblems(value);
  problems.forEach((problem) => errors.add(field, problem));
  return problems.length === 0 ? value : undefined;
}

export function validateLogin(body) {
  const data = requireBody(body);
  const errors = new FieldErrors();
  const identifier = typeof data.identifier === 'string' ? data.identifier.trim() : '';
  if (identifier.length === 0) {
    errors.add('identifier', 'Ingresa tu usuario o correo electrónico.');
  }
  if (typeof data.password !== 'string' || data.password.length === 0) {
    errors.add('password', 'Ingresa tu contraseña.');
  }
  errors.throwIfAny();
  return { identifier, password: data.password };
}

export function validateChangePassword(body) {
  const data = requireBody(body);
  const errors = new FieldErrors();
  if (typeof data.currentPassword !== 'string' || data.currentPassword.length === 0) {
    errors.add('currentPassword', 'Ingresa tu contraseña actual.');
  }
  checkNewPassword(errors, data.newPassword);
  errors.throwIfAny();
  return { currentPassword: data.currentPassword, newPassword: data.newPassword };
}
