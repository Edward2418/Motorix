import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize, ROLES } from '../middlewares/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// El panel de control es solo para administración (se valida aquí, en el servidor).
const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN));
router.get('/', asyncHandler(dashboardController.get));

export default router;
