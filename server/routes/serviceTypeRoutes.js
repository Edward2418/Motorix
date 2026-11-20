import { Router } from 'express';
import * as serviceTypeController from '../controllers/serviceTypeController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize, ROLES } from '../middlewares/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Cualquier rol autenticado lee el catálogo (lo necesita para elegir el tipo en una orden); solo administración lo
// modifica. No existe DELETE: un tipo usado se desactiva.
const router = Router();

router.use(authenticate);
router.get('/', asyncHandler(serviceTypeController.list));
router.post('/', authorize(ROLES.ADMIN), asyncHandler(serviceTypeController.create));
router.put('/:id', authorize(ROLES.ADMIN), asyncHandler(serviceTypeController.update));
router.patch('/:id/status', authorize(ROLES.ADMIN), asyncHandler(serviceTypeController.setStatus));

export default router;
