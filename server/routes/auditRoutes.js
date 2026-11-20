import { Router } from 'express';
import * as auditController from '../controllers/auditController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize, ROLES } from '../middlewares/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// La bitácora es solo de consulta y solo para administración. No existe ninguna ruta que la edite o borre: cualquier
// otro método responde 404.
const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN));
router.get('/', asyncHandler(auditController.list));

export default router;
