import { AppError } from '../utils/AppError.js';

// Ayudantes de validación y sanitización compartidos por todos los validadores.
// Cada validador acumula errores por campo y, si hay alguno, lanza un error 400.

export class FieldErrors {
  constructor() {
    this.items = [];
  }

  add(field, message) {
    this.items.push({ field, message });
  }

  throwIfAny() {
    if (this.items.length > 0) {
      throw AppError.validation('Hay datos inválidos. Revisa los campos indicados.', this.items);
    }
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Devuelve el cuerpo como objeto; si no lo es, lanza un 400.
export function requireBody(body) {
  if (!isPlainObject(body)) {
    throw AppError.validation('El cuerpo de la petición debe ser un objeto JSON.');
  }
  return body;
}

// Texto obligatorio: recorta espacios y valida longitud máxima.
export function requiredText(errors, body, field, label, maxLength) {
  const value = typeof body[field] === 'string' ? body[field].trim() : '';
  if (value.length === 0) {
    errors.add(field, `${label} es obligatorio.`);
    return undefined;
  }
  if (value.length > maxLength) {
    errors.add(field, `${label} no puede tener más de ${maxLength} caracteres.`);
    return undefined;
  }
  return value;
}

// Texto opcional: devuelve null si falta o viene vacío.
export function optionalText(errors, body, field, label, maxLength) {
  const raw = body[field];
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) {
    return null;
  }
  if (typeof raw !== 'string') {
    errors.add(field, `${label} debe ser texto.`);
    return undefined;
  }
  const value = raw.trim();
  if (value.length > maxLength) {
    errors.add(field, `${label} no puede tener más de ${maxLength} caracteres.`);
    return undefined;
  }
  return value;
}

export function validEmail(value) {
  return value.length <= 254 && EMAIL_PATTERN.test(value);
}

// Correo obligatorio, en minúsculas.
export function requiredEmail(errors, body, field = 'email', label = 'El correo electrónico') {
  const value = requiredText(errors, body, field, label, 254);
  if (value === undefined) {
    return undefined;
  }
  if (!validEmail(value)) {
    errors.add(field, `${label} no tiene un formato válido.`);
    return undefined;
  }
  return value.toLowerCase();
}

// Correo opcional, en minúsculas.
export function optionalEmail(errors, body, field = 'email', label = 'El correo electrónico') {
  const value = optionalText(errors, body, field, label, 254);
  if (value === undefined || value === null) {
    return value;
  }
  if (!validEmail(value)) {
    errors.add(field, `${label} no tiene un formato válido.`);
    return undefined;
  }
  return value.toLowerCase();
}

// Teléfono: entre 7 y 15 dígitos; se permiten +, espacios, guiones y paréntesis.
export function requiredPhone(errors, body, field = 'phone', label = 'El teléfono') {
  const value = requiredText(errors, body, field, label, 20);
  if (value === undefined) {
    return undefined;
  }
  const digits = value.replace(/\D/g, '');
  if (!/^[+\d\s\-()]+$/.test(value) || digits.length < 7 || digits.length > 15) {
    errors.add(field, `${label} debe tener entre 7 y 15 dígitos (se permiten +, espacios, guiones y paréntesis).`);
    return undefined;
  }
  return value;
}

// Entero positivo (para identificadores).
export function parseId(value, label = 'El identificador') {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw AppError.validation(`${label} no es válido.`);
  }
  return number;
}

export function parsePagination(query) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const pageSize = query.pageSize === undefined ? 20 : Number(query.pageSize);
  if (!Number.isInteger(page) || page < 1) {
    throw AppError.validation('El parámetro page debe ser un entero mayor o igual a 1.');
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw AppError.validation('El parámetro pageSize debe ser un entero entre 1 y 100.');
  }
  return { page, pageSize };
}

// Filtro de estado: true (por defecto), false o all.
export function parseActiveFilter(value) {
  if (value === undefined || value === 'true') {
    return 'true';
  }
  if (value === 'false' || value === 'all') {
    return value;
  }
  throw AppError.validation('El parámetro active debe ser true, false o all.');
}

export function parseSearch(value) {
  if (value === undefined) {
    return '';
  }
  if (typeof value !== 'string' || value.length > 100) {
    throw AppError.validation('El parámetro search debe ser texto de hasta 100 caracteres.');
  }
  return value.trim();
}

// Cuerpo de cambio de estado: { active: boolean }.
export function validateStatusBody(body) {
  const data = requireBody(body);
  if (typeof data.active !== 'boolean') {
    throw AppError.validation('El campo active es obligatorio y debe ser verdadero o falso.', [
      { field: 'active', message: 'El campo active es obligatorio y debe ser verdadero o falso.' }
    ]);
  }
  return data.active;
}

// Escapa los comodines de LIKE para que la búsqueda sea literal.
export function likePattern(search) {
  return `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
