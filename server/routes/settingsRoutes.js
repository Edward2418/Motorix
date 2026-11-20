import { Router } from 'express';
import * as settingsController from '../controllers/settingsController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize, ROLES } from '../middlewares/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// La configuración del taller es solo para administración (se valida aquí, en el servidor). No existe DELETE.
const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN));
router.get('/', asyncHandler(settingsController.get));
router.put('/', asyncHandler(settingsController.update));

export default router;
