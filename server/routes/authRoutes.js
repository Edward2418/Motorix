import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post('/login', asyncHandler(authController.login));
router.get('/me', authenticate, asyncHandler(authController.me));
router.put('/password', authenticate, asyncHandler(authController.changePassword));

export default router;
