import * as userModel from '../models/userModel.js';
import { verifyToken } from '../utils/jwt.js';
import { AppError } from '../utils/AppError.js';

// Verifica el JWT y recarga el usuario: así una cuenta desactivada o con otro rol
// pierde el acceso de inmediato, sin esperar a que venza el token.
export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw AppError.unauthenticated();
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw AppError.unauthenticated('Tu sesión no es válida o ya venció. Inicia sesión de nuevo.');
    }

    const user = await userModel.findById(payload.sub);
    if (!user || !user.active) {
      throw AppError.unauthenticated('Tu sesión no es válida o ya venció. Inicia sesión de nuevo.');
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
