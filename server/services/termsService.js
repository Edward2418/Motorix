import * as termsModel from '../models/termsModel.js';
import { AppError } from '../utils/AppError.js';

// Términos y condiciones y aviso de privacidad (Sprint 7).

/** Versión vigente con sus dos textos y si `userId` ya la aceptó; `null` si no hay ninguna publicada. */
export async function getCurrent(userId) {
  const current = await termsModel.findCurrent();
  if (!current) {
    return null;
  }
  return {
    version: current.version,
    termsText: current.termsText,
    privacyText: current.privacyText,
    publishedAt: current.publishedAt,
    accepted: await termsModel.hasAcceptedCurrent(userId)
  };
}

/** Versión vigente para leerla sin sesión (pantalla de inicio): solo el documento, sin datos de ningún usuario. */
export async function getPublic() {
  const current = await termsModel.findCurrent();
  if (!current) {
    return null;
  }
  return { version: current.version, termsText: current.termsText, privacyText: current.privacyText, publishedAt: current.publishedAt };
}

/**
 * Registra que `userId` aceptó `version`. Una versión que no existe es un dato inválido (400); una que existe pero ya
 * no es la vigente es un conflicto (409), porque se publicó otra más nueva. Aceptar dos veces no duplica el registro.
 */
export async function accept(userId, version) {
  const requested = await termsModel.findByVersion(version);
  if (!requested) {
    throw AppError.validation('Esa versión de los términos no existe.', [
      { field: 'version', message: 'Esa versión de los términos no existe.' }
    ]);
  }
  const current = await termsModel.findCurrent();
  if (current.version !== requested.version) {
    throw AppError.termsVersionOutdated();
  }
  const acceptedAt = await termsModel.accept(userId, requested.id);
  return { version: requested.version, acceptedAt };
}

export function listAcceptances(filters) {
  return termsModel.listAcceptances(filters);
}

/** ¿Puede usar el sistema? `true` si aceptó la versión vigente o si no hay ninguna publicada. */
export function hasAcceptedCurrent(userId) {
  return termsModel.hasAcceptedCurrent(userId);
}
