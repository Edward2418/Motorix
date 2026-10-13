import { Router } from 'express';
import * as clientController from '../controllers/clientController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize, ROLES } from '../middlewares/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Consulta: los tres roles. Registro y edición: ADMIN y RECEPTIONIST.
const canWrite = authorize(ROLES.ADMIN, ROLES.RECEPTIONIST);

router.use(authenticate);
router.get('/', asyncHandler(clientController.list));
router.get('/:id', asyncHandler(clientController.get));
router.post('/', canWrite, asyncHandler(clientController.create));
router.put('/:id', canWrite, asyncHandler(clientController.update));
router.patch('/:id/status', canWrite, asyncHandler(clientController.setStatus));

export default router;
