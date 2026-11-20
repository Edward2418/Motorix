// Reglas puras de los términos y condiciones (Sprint 7): cuál es la versión vigente y quién debe aceptarla.

/** La versión vigente es la de mayor número; `null` si no hay ninguna publicada. */
export function currentVersion(versions) {
  return versions.reduce((latest, item) => (!latest || item.version > latest.version ? item : latest), null);
}

/**
 * Indica si un usuario debe aceptar antes de seguir. Sin versión publicada no se exige nada; con una publicada, debe
 * haber aceptado precisamente la vigente (haber aceptado una anterior no basta).
 */
export function requiresAcceptance(current, acceptedVersions) {
  if (!current) {
    return false;
  }
  return !acceptedVersions.includes(current.version);
}
