import { AppError } from '../utils/AppError.js';
import { parseKey } from '../services/notificationRules.js';
import { NOTICE_REASONS, reasonPrefix } from '../services/clientNoticeService.js';

// Cuerpo de POST /notifications/read: la clave debe cumplir ^(MAINT|APPT|STOCK|ORDER):[0-9]+$ y tener como máximo
// 60 caracteres. Un dato inválido responde 400 VALIDATION_ERROR con el detalle por campo, como en el resto de la API.
export function validateReadBody(body) {
  const key = body?.key;
  if (typeof key !== 'string' || parseKey(key) === null) {
    const message = 'La clave del aviso debe tener el formato TIPO:id, por ejemplo STOCK:3.';
    throw AppError.validation(message, [{ field: 'key', message }]);
  }
  return { key };
}

const FACT_KEY_PATTERN = /^(ORDER|APPT|MAINT):[0-9]+$/;
const NOTE_MAX = 255;

/**
 * Cuerpo de POST /client-notices: `reason` dentro del ENUM, `factKey` con el formato `^(ORDER|APPT|MAINT):[0-9]+$`
 * (máximo 60 caracteres) que además corresponda al motivo, y `note` opcional de hasta 255 caracteres.
 */
export function validateNoticeBody(body) {
  const details = [];
  const reason = body?.reason;
  const factKey = body?.factKey;
  const rawNote = body?.note;

  if (typeof reason !== 'string' || !NOTICE_REASONS.includes(reason)) {
    details.push({ field: 'reason', message: `El motivo debe ser uno de: ${NOTICE_REASONS.join(', ')}.` });
  }
  if (typeof factKey !== 'string' || factKey.length > 60 || !FACT_KEY_PATTERN.test(factKey)) {
    details.push({ field: 'factKey', message: 'El hecho debe tener el formato TIPO:id, por ejemplo ORDER:41.' });
  } else if (NOTICE_REASONS.includes(reason) && factKey.split(':')[0] !== reasonPrefix(reason)) {
    details.push({ field: 'factKey', message: `El hecho de un aviso por ${reason} debe empezar con ${reasonPrefix(reason)}:.` });
  }
  let note = null;
  if (rawNote !== undefined && rawNote !== null) {
    if (typeof rawNote !== 'string' || rawNote.length > NOTE_MAX) {
      details.push({ field: 'note', message: `La nota debe ser texto de como máximo ${NOTE_MAX} caracteres.` });
    } else {
      note = rawNote.trim() === '' ? null : rawNote.trim();
    }
  }
  if (details.length > 0) {
    throw AppError.validation(details[0].message, details);
  }
  return { reason, factKey, note };
}
