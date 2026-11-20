import { Router } from 'express';
import * as clientNoticeController from '../controllers/clientNoticeController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize, ROLES } from '../middlewares/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Solo ADMIN y RECEPTIONIST: el mecánico recibe 403 aunque pida la ruta directamente. No existe PUT ni DELETE.
router.use(authenticate, authorize(ROLES.ADMIN, ROLES.RECEPTIONIST));
router.get('/', asyncHandler(clientNoticeController.list));
router.post('/', asyncHandler(clientNoticeController.register));

export default router;
