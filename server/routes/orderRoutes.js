import { Router } from 'express';
import * as orderController from '../controllers/orderController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize, ROLES } from '../middlewares/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Crear y reasignar: ADMIN y RECEPTIONIST. Consultar: los tres roles (el mecánico, solo las suyas).
const manage = authorize(ROLES.ADMIN, ROLES.RECEPTIONIST);

router.use(authenticate);
router.post('/', manage, asyncHandler(orderController.create));
router.get('/:id', asyncHandler(orderController.get));
router.put('/:id/mechanic', manage, asyncHandler(orderController.reassignMechanic));

export default router;
