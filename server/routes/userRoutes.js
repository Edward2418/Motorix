import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize, ROLES } from '../middlewares/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Toda la gestión de usuarios es exclusiva del administrador.
router.use(authenticate, authorize(ROLES.ADMIN));
router.get('/', asyncHandler(userController.list));
router.post('/', asyncHandler(userController.create));
router.get('/:id', asyncHandler(userController.get));
router.put('/:id', asyncHandler(userController.update));
router.patch('/:id/status', asyncHandler(userController.setStatus));

export default router;
