import { Router } from 'express';
import * as appointmentController from '../controllers/appointmentController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize, ROLES } from '../middlewares/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Las citas las gestionan solo ADMIN y RECEPTIONIST; el mecánico no tiene acceso. No existe DELETE.
router.use(authenticate, authorize(ROLES.ADMIN, ROLES.RECEPTIONIST));
router.get('/', asyncHandler(appointmentController.list));
router.post('/', asyncHandler(appointmentController.create));
router.get('/:id', asyncHandler(appointmentController.get));
router.put('/:id', asyncHandler(appointmentController.update));
router.post('/:id/confirm', asyncHandler(appointmentController.confirm));
router.post('/:id/cancel', asyncHandler(appointmentController.cancel));

export default router;
