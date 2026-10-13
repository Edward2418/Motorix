import { Router } from 'express';
import * as vehicleController from '../controllers/vehicleController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize, ROLES } from '../middlewares/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Consulta: los tres roles. Registro y cambio de estado: ADMIN y RECEPTIONIST.
const canWrite = authorize(ROLES.ADMIN, ROLES.RECEPTIONIST);

router.use(authenticate);
router.get('/', asyncHandler(vehicleController.list));
router.get('/:id', asyncHandler(vehicleController.get));
router.get('/:id/history', asyncHandler(vehicleController.history));
router.post('/', canWrite, asyncHandler(vehicleController.create));
router.patch('/:id/status', canWrite, asyncHandler(vehicleController.setStatus));

export default router;
