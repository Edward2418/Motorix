// Clasificación pura de los mantenimientos programados: Normal, Próximo o Vencido.
// No accede a la base de datos. La fecha de hoy y los umbrales se reciben como parámetros para poder probarlo.

const MS_PER_DAY = 86400000;

// Convierte 'YYYY-MM-DD' en días absolutos (UTC) para restar fechas sin efectos de zona horaria.
function toDay(isoDate) {
  const [year, month, day] = String(isoDate).slice(0, 10).split('-').map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

/**
 * Devuelve { visualStatus, remainingDays, remainingKm }.
 * VENCIDO: la fecha ya pasó o el kilometraje actual alcanzó el objetivo.
 * PROXIMO: faltan `soonDays` días o menos, o `soonKm` kilómetros o menos.
 * NORMAL: en otro caso. Con fecha y kilometraje manda el más grave.
 */
export function classifyMaintenance({ dueDate, dueMileage, currentMileage, today, soonDays, soonKm }) {
  const remainingDays = dueDate ? toDay(dueDate) - toDay(today) : null;
  const remainingKm = dueMileage !== null && dueMileage !== undefined ? dueMileage - currentMileage : null;

  let visualStatus = 'NORMAL';
  if ((remainingDays !== null && remainingDays < 0) || (remainingKm !== null && remainingKm <= 0)) {
    visualStatus = 'VENCIDO';
  } else if ((remainingDays !== null && remainingDays <= soonDays) || (remainingKm !== null && remainingKm <= soonKm)) {
    visualStatus = 'PROXIMO';
  }
  return { visualStatus, remainingDays, remainingKm };
}

const RANK = Object.freeze({ VENCIDO: 0, PROXIMO: 1, NORMAL: 2 });

// Los nulos van al final al comparar de menor a mayor.
const nullsLast = (a, b) => {
  if (a === b) {
    return 0;
  }
  if (a === null) {
    return 1;
  }
  if (b === null) {
    return -1;
  }
  return a - b;
};

/**
 * Orden de urgencia: vencidos, luego próximos y luego normales. Dentro de cada grupo, primero la fecha más
 * cercana (o más atrasada), después los que solo tienen kilometraje por menor kilometraje restante, y por último
 * el identificador para que el orden sea estable.
 */
export function compareUrgency(a, b) {
  return (
    RANK[a.visualStatus] - RANK[b.visualStatus] ||
    nullsLast(a.remainingDays, b.remainingDays) ||
    nullsLast(a.remainingKm, b.remainingKm) ||
    (a.id ?? 0) - (b.id ?? 0)
  );
}
