import * as auditModel from '../models/auditModel.js';

// Bitácora de acciones sensibles (Sprint 7). Solo guarda quién, qué, sobre qué y cuándo, con un detalle breve. Nunca
// guarda contraseñas, hashes, tokens ni datos de tarjeta: acepta únicamente los campos de la lista cerrada de abajo y
// rechaza un detalle que parezca un secreto, de modo que un error de programación se vea en las pruebas y no en la bitácora.

/** Lista cerrada de acciones que se registran (FR-021). */
export const AUDIT_ACTIONS = Object.freeze([
  'LOGIN_FAILED',
  'ACCOUNT_LOCKED',
  'USER_CREATED',
  'USER_ACTIVATED',
  'USER_DEACTIVATED',
  'USER_ROLE_CHANGED',
  'SETTINGS_CHANGED',
  'PART_PRICE_CHANGED',
  'PAYMENT_CANCELLED'
]);

const DETAIL_MAX = 255;

// Patrones de lo que NO debe llegar nunca a la bitácora: hash bcrypt, token JWT, «contraseña:»/«password=» y números
// de tarjeta (de 13 a 19 dígitos, con o sin guiones o espacios).
const SECRET_PATTERNS = [
  /\$2[aby]\$\d{2}\$/,
  /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]+/,
  /(contrase[ñn]a|password|passwd|pwd|token)\s*[:=]/i,
  /\b(?:\d[ -]?){13,19}\b/
];

const looksLikeSecret = (text) => SECRET_PATTERNS.some((pattern) => pattern.test(text));

/** `model` se inyecta para poder probar el servicio sin base de datos. */
export function createAuditService({ model = auditModel } = {}) {
  /**
   * Registra una acción. `conn` es la conexión de la transacción de la acción registrada (así, si se revierte, el
   * registro también). Sin `userId` no se guarda el actor, aunque se pase.
   */
  async function record({ userId = null, actor = null, action, entity = null, entityId = null, detail = null }, conn) {
    if (!AUDIT_ACTIONS.includes(action)) {
      throw new Error(`Acción de bitácora desconocida: ${action}`);
    }
    if (typeof detail === 'string' && looksLikeSecret(detail)) {
      throw new Error('El detalle de la bitácora parece contener un dato sensible (contraseña, hash, token o tarjeta).');
    }
    return model.insert(
      {
        userId,
        actor: userId === null ? null : actor,
        action,
        entity,
        entityId,
        detail: typeof detail === 'string' ? detail.slice(0, DETAIL_MAX) : null
      },
      conn
    );
  }

  /** Consulta paginada y filtrada (solo administración, validado en la ruta). */
  function list(filters) {
    return model.list(filters);
  }

  return { record, list };
}

export const auditService = createAuditService();
