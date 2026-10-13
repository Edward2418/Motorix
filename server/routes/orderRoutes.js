import { Router } from 'express';
import * as orderController from '../controllers/orderController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize, ROLES } from '../middlewares/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Crear y reasignar: ADMIN y RECEPTIONIST. Consultar: los tres roles (el mecánico, solo las suyas).
const manage = authorize(ROLES.ADMIN, ROLES.RECEPTIONIST);

router.use(authenticate);
router.get('/', asyncHandler(orderController.list));
router.post('/', manage, asyncHandler(orderController.create));
router.get('/:id', asyncHandler(orderController.get));
router.put('/:id/mechanic', manage, asyncHandler(orderController.reassignMechanic));

// Cambio de estado: los tres roles; el servicio decide por rol y propiedad (403 o 409).
router.post('/:id/status', asyncHandler(orderController.changeStatus));

// Corregir el kilometraje del servicio de una orden finalizada: solo ADMIN.
router.put('/:id/service-mileage', authorize(ROLES.ADMIN), asyncHandler(orderController.correctServiceMileage));

// Contenido técnico, servicios y mano de obra: los permisos por rol y por propiedad los valida el servicio.
router.patch('/:id', asyncHandler(orderController.updateContent));
for (const kind of ['services', 'labor']) {
  router.post('/:id/' + kind, asyncHandler(orderController.addLine(kind)));
  router.put('/:id/' + kind + '/:lineId', asyncHandler(orderController.updateLine(kind)));
  router.delete('/:id/' + kind + '/:lineId', asyncHandler(orderController.removeLine(kind)));
}

export default router;
