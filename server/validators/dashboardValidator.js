import { AppError } from '../utils/AppError.js';
import { PERIOD_KEYS } from '../services/dashboardPeriods.js';

// Consulta del panel: el periodo es today, week o month (month por defecto).
export function validateDashboardQuery(query) {
  const period = query.period === undefined ? 'month' : query.period;
  if (typeof period !== 'string' || !PERIOD_KEYS.includes(period)) {
    const message = `El periodo debe ser uno de: ${PERIOD_KEYS.join(', ')}.`;
    throw AppError.validation(message, [{ field: 'period', message }]);
  }
  return { period };
}
