// Orígenes permitidos para CORS. Solo afecta a los navegadores: la aplicación de escritorio, curl y las pruebas no envían
// la cabecera `Origin` y siempre pasan.
//
// - Sin `CORS_ORIGINS` (desarrollo local): se aceptan solo los orígenes locales (localhost, 127.0.0.1 y [::1]).
// - Con `CORS_ORIGINS` (producción): se aceptan únicamente los orígenes de la lista y ya no los locales.

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/** Convierte el texto de `CORS_ORIGINS` (orígenes separados por comas) en una lista limpia, sin barra final. */
export function parseAllowedOrigins(text) {
  return String(text ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin.length > 0);
}

/** Opciones del paquete `cors`: permite el origen si cumple la regla y, si no, no envía las cabeceras de permiso. */
export function buildCorsOptions(allowedOrigins = []) {
  return {
    // El navegador puede leer el token nuevo que se entrega al cambiar la contraseña.
    exposedHeaders: ['X-Auth-Token'],
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      const allowed = allowedOrigins.length > 0 ? allowedOrigins.includes(origin) : LOCAL_ORIGIN.test(origin);
      callback(null, allowed);
    }
  };
}
