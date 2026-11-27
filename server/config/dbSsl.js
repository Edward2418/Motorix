/**
 * Opciones TLS de la conexión a la base. Una base en la nube (por ejemplo TiDB Cloud) exige cifrado: con `DB_SSL=true`
 * se usa TLS 1.2 o superior y se verifica el certificado. Sin ese valor (base local) la conexión no cambia.
 */
export function buildSsl(value) {
  return String(value ?? '').trim().toLowerCase() === 'true' ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined;
}
