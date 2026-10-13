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
  errors.throwIfAny();
  return { name, phone, email };
}

export function validateClientListQuery(query) {
  return {
    search: parseSearch(query.search),
    active: parseActiveFilter(query.active),
    ...parsePagination(query)
  };
}
