import { AppError } from '../utils/AppError.js';

// Permite el paso solo a los roles indicados. Debe ir después de `authenticate`.
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthenticated());
    }
    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden());
    }
    return next();
  };
}

export const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  RECEPTIONIST: 'RECEPTIONIST',
  MECHANIC: 'MECHANIC'
});
