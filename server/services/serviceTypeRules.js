// Reglas puras del catálogo de tipos de servicio (Sprint 7): validación y propuesta del próximo mantenimiento.

export const NAME_MAX = 80;
export const INTERVAL_DAYS_MAX = 3650;
export const INTERVAL_KM_MAX = 500000;

function checkInterval(errors, input, field, label, max) {
  const raw = input[field];
  if (raw === undefined || raw === null) {
    return null;
  }
  if (!Number.isInteger(raw) || raw < 1 || raw > max) {
    errors.push({ field, message: `${label} debe ser un entero entre 1 y ${max.toLocaleString('en-US')}.` });
    return null;
  }
  return raw;
}

/**
 * Valida un tipo de servicio: nombre de 1 a 80 caracteres, intervalo en días de 1 a 3650, intervalo en kilómetros de 1
 * a 500,000 y al menos uno de los dos intervalos. Devuelve `{ value, errors }`; `value` ya normalizado (nombre recortado
 * y el intervalo que falta como `null`).
 */
export function validateServiceTypeInput(input) {
  const errors = [];
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name.length < 1 || name.length > NAME_MAX) {
    errors.push({ field: 'name', message: `El nombre es obligatorio y debe tener hasta ${NAME_MAX} caracteres.` });
  }
  const intervalDays = checkInterval(errors, input, 'intervalDays', 'El intervalo en días', INTERVAL_DAYS_MAX);
  const intervalKm = checkInterval(errors, input, 'intervalKm', 'El intervalo en kilómetros', INTERVAL_KM_MAX);
  const providedAny = [input.intervalDays, input.intervalKm].some((value) => value !== undefined && value !== null);
  if (!providedAny) {
    errors.push({ field: 'intervalDays', message: 'Indica al menos un intervalo: en días, en kilómetros o en ambos.' });
  }
  return { value: { name, intervalDays, intervalKm }, errors };
}

// Suma días a una fecha `AAAA-MM-DD` con aritmética en UTC (sin saltos por horario de verano).
function addDays(date, days) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Propuesta del próximo mantenimiento por tipo de servicio con intervalo. La fecha es hoy + el intervalo en días; el
 * kilometraje es el del servicio (o el actual del vehículo si el servicio no lo tiene, o si este es mayor) + el
 * intervalo en kilómetros, así siempre queda por encima del kilometraje actual. Un tipo repetido produce una sola
 * propuesta y los tipos sin ningún intervalo no producen ninguna.
 */
export function computeSuggestions({ types, today, serviceMileage, currentMileage }) {
  const baseMileage = Math.max(serviceMileage ?? 0, currentMileage ?? 0);
  const seen = new Set();
  const suggestions = [];
  for (const type of types) {
    if (seen.has(type.id) || (type.intervalDays == null && type.intervalKm == null)) {
      continue;
    }
    seen.add(type.id);
    suggestions.push({
      serviceTypeId: type.id,
      serviceTypeName: type.name,
      description: type.name,
      dueDate: type.intervalDays == null ? null : addDays(today, type.intervalDays),
      dueMileage: type.intervalKm == null ? null : baseMileage + type.intervalKm
    });
  }
  return suggestions;
}
