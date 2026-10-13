import { Router } from 'express';
import * as maintenanceController from '../controllers/maintenanceController.js';
import * as orderController from '../controllers/orderController.js';
import * as orderPartController from '../controllers/orderPartController.js';
import * as paymentController from '../controllers/paymentController.js';
import * as ticketController from '../controllers/ticketController.js';
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
// Próximo mantenimiento del vehículo, programado desde la orden (la propiedad la valida el servicio).
router.post('/:id/maintenance', asyncHandler(maintenanceController.createFromOrder));

// Refacciones usadas: el servicio valida rol, propiedad y estado; cada cambio mueve el inventario.
router.post('/:id/parts', asyncHandler(orderPartController.add));
router.put('/:id/parts/:lineId', asyncHandler(orderPartController.updateQuantity));
router.delete('/:id/parts/:lineId', asyncHandler(orderPartController.remove));

// Pagos de la orden: solo ADMIN y RECEPTIONIST (el mecánico recibe 403).
router.get('/:id/payments', manage, asyncHandler(paymentController.listByOrder));
router.post('/:id/payments', manage, asyncHandler(paymentController.create));

// Ticket de servicio: un ticket por orden, solo ADMIN y RECEPTIONIST. No existen rutas para editarlo ni eliminarlo.
router.post('/:id/ticket', manage, asyncHandler(ticketController.generate));
router.get('/:id/ticket', manage, asyncHandler(ticketController.get));

for (const kind of ['services', 'labor']) {
  router.post('/:id/' + kind, asyncHandler(orderController.addLine(kind)));
  router.put('/:id/' + kind + '/:lineId', asyncHandler(orderController.updateLine(kind)));
  router.delete('/:id/' + kind + '/:lineId', asyncHandler(orderController.removeLine(kind)));
}

export default router;
