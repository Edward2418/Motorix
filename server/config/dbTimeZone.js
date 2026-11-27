/**
 * Desfase horario de la sesión con la base (`DB_TIME_ZONE`, por ejemplo `-06:00`). Una base en la nube suele trabajar en
 * UTC; sin igualarla con la hora del taller, `CURRENT_TIMESTAMP` y `NOW()` quedarían desfasados y los reportes y avisos
 * cortarían mal los días. Sin valor no se cambia nada.
 */
export function readTimeZone(value) {
  const text = String(value ?? '').trim();
  if (text === '') {
    return undefined;
  }
  if (!/^[+-](0\d|1[0-4]):[0-5]\d$/.test(text)) {
    throw new Error(`La variable DB_TIME_ZONE debe ser un desfase como -06:00 (valor recibido: "${text}").`);
  }
  return text;
}
