import { checkNewPassword } from './authValidator.js';
import {
  FieldErrors,
  parseActiveFilter,
  parsePagination,
  parseSearch,
  requiredEmail,
  requiredText,
  requireBody
} from './common.js';

export const ROLE_VALUES = ['ADMIN', 'RECEPTIONIST', 'MECHANIC'];

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,50}$/;

function checkRole(errors, value) {
  if (!ROLE_VALUES.includes(value)) {
    errors.add('role', `El rol debe ser uno de: ${ROLE_VALUES.join(', ')}.`);
    return undefined;
  }
  return value;
}

// Alta de usuario: usuario, nombre, correo, contraseña (política mínima) y rol.
export function validateUserCreate(body) {
  const data = requireBody(body);
  const errors = new FieldErrors();

  let username;
  const rawUsername = requiredText(errors, data, 'username', 'El nombre de usuario', 50);
  if (rawUsername !== undefined) {
    if (USERNAME_PATTERN.test(rawUsername)) {
      username = rawUsername;
    } else {
      errors.add(
        'username',
        'El nombre de usuario debe tener entre 3 y 50 caracteres: letras, números, punto, guion y guion bajo.'
      );
    }
  }

  const name = requiredText(errors, data, 'name', 'El nombre', 100);
  const email = requiredEmail(errors, data);
  const password = checkNewPassword(errors, data.password, 'password');
  const role = checkRole(errors, data.role);

  errors.throwIfAny();
  return { username, name, email, password, role };
}

// Edición: nombre, correo y rol. El nombre de usuario y la contraseña no se cambian aquí.
export function validateUserUpdate(body) {
  const data = requireBody(body);
  const errors = new FieldErrors();
  const name = requiredText(errors, data, 'name', 'El nombre', 100);
  const email = requiredEmail(errors, data);
  const role = checkRole(errors, data.role);
  errors.throwIfAny();
  return { name, email, role };
}

export function validateUserListQuery(query) {
  return {
    search: parseSearch(query.search),
    active: parseActiveFilter(query.active),
    ...parsePagination(query)
  };
}
