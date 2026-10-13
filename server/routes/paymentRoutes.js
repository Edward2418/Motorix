import { Router } from 'express';
import * as paymentController from '../controllers/paymentController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize, ROLES } from '../middlewares/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Pagos y tickets son de administración y recepción; el mecánico no tiene acceso (se valida aquí, en el servidor).
const router = Router();
const manage = authorize(ROLES.ADMIN, ROLES.RECEPTIONIST);

router.use(authenticate, manage);

router.get('/config', asyncHandler(paymentController.config));

// Los pagos nunca se eliminan ni se editan: solo se cancelan con motivo.
router.post('/:id/cancel', asyncHandler(paymentController.cancel));

export default router;
