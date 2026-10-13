import {
  FieldErrors,
  optionalEmail,
  parseActiveFilter,
  parsePagination,
  parseSearch,
  requiredPhone,
  requiredText,
  requireBody
} from './common.js';

// Datos de un cliente: nombre y teléfono obligatorios, correo opcional.
export function validateClientInput(body) {
  const data = requireBody(body);
  const errors = new FieldErrors();
  const name = requiredText(errors, data, 'name', 'El nombre', 100);
  const phone = requiredPhone(errors, data);
  const email = optionalEmail(errors, data);
  let confirmDuplicate = false;
  if (data.confirmDuplicate !== undefined) {
    if (typeof data.confirmDuplicate === 'boolean') {
      confirmDuplicate = data.confirmDuplicate;
    } else {
      errors.add('confirmDuplicate', 'confirmDuplicate debe ser verdadero o falso.');
    }
  }
  errors.throwIfAny();
  return { name, phone, email, confirmDuplicate };
}

export function validateClientListQuery(query) {
  return {
    search: parseSearch(query.search),
    active: parseActiveFilter(query.active),
    ...parsePagination(query)
  };
}
