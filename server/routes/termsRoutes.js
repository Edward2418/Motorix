import { Router } from 'express';
import * as termsController from '../controllers/termsController.js';
import { authenticate, authenticateIgnoringTerms } from '../middlewares/authenticate.js';
import { authorize, ROLES } from '../middlewares/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Leer y aceptar los términos las necesita justamente quien aún no los aceptó, así que esas dos rutas son las únicas que
// no pasan por el filtro de aceptación. La lista de aceptaciones sí lo exige y es solo para administración. No hay
// ninguna ruta para editar o borrar versiones: se publican con server/scripts/publish-terms.js.
const router = Router();

router.get('/current', authenticateIgnoringTerms, asyncHandler(termsController.current));
router.post('/accept', authenticateIgnoringTerms, asyncHandler(termsController.accept));
router.get('/acceptances', authenticate, authorize(ROLES.ADMIN), asyncHandler(termsController.acceptances));

export default router;
