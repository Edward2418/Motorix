// Lectura de variables de entorno numéricas con valor por defecto.

/**
 * Convierte el texto de una variable de entorno en un entero mayor que cero.
 * Si está vacía o no existe devuelve `fallback`; si es inválida lanza un error que nombra la variable.
 */
export function readPositiveInt(raw, fallback, name) {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return fallback;
  }
  const text = String(raw).trim();
  if (!/^\d+$/.test(text) || Number(text) < 1) {
    throw new Error(`La variable ${name} debe ser un número entero mayor que cero (valor recibido: "${text}").`);
  }
  return Number(text);
}
