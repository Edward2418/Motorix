import { Router } from 'express';
import * as partController from '../controllers/partController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize, ROLES } from '../middlewares/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Alta, edición y estado: solo ADMIN. Consulta: ADMIN y MECHANIC (solo activas y sin precio de compra).
// RECEPTIONIST no accede al inventario.
const admin = authorize(ROLES.ADMIN);
const readers = authorize(ROLES.ADMIN, ROLES.MECHANIC);

router.use(authenticate);
router.get('/', readers, asyncHandler(partController.list));
router.post('/', admin, asyncHandler(partController.create));
// Las rutas fijas van antes de /:id.
router.get('/categories', readers, asyncHandler(partController.categories));
router.get('/:id', readers, asyncHandler(partController.get));
router.put('/:id', admin, asyncHandler(partController.update));
router.patch('/:id/status', admin, asyncHandler(partController.setStatus));

export default router;
