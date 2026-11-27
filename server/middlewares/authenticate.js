import * as userModel from '../models/userModel.js';
import * as termsService from '../services/termsService.js';
import { sessionStamp, verifyToken } from '../utils/jwt.js';
import { AppError } from '../utils/AppError.js';

// Verifica el JWT y recarga el usuario: así una cuenta desactivada, con otro rol o con otra contraseña
// pierde el acceso de inmediato, sin esperar a que venza el token. Con `enforceTerms`, además, exige que haya aceptado
// la versión vigente de los términos y condiciones (si hay una publicada): es el filtro central de la aceptación, así
// ninguna ruta puede olvidarlo.
function createAuthenticate({ enforceTerms }) {
  return async function authenticateRequest(req, res, next) {
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

      const row = await userModel.findAuthById(payload.sub);
      // `pv` deja de coincidir cuando cambia la contraseña: así se invalidan los tokens anteriores.
      if (!row || !row.active || payload.pv !== sessionStamp(row.password_hash)) {
        throw AppError.unauthenticated('Tu sesión no es válida o ya venció. Inicia sesión de nuevo.');
      }
      const user = userModel.toUser(row);
      if (enforceTerms && !(await termsService.hasAcceptedCurrent(user.id))) {
        throw AppError.termsNotAccepted();
      }
      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const authenticate = createAuthenticate({ enforceTerms: true });

/** Solo para leer y aceptar los términos: autentica igual, pero no exige haberlos aceptado. */
export const authenticateIgnoringTerms = createAuthenticate({ enforceTerms: false });
