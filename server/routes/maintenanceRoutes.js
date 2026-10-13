import { Router } from 'express';
import * as maintenanceController from '../controllers/maintenanceController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Consulta para los tres roles. Atender y cancelar: administración, recepción y el mecánico de la orden de origen
// (la propiedad la valida el servicio). No existe ninguna ruta para eliminar mantenimientos.
router.use(authenticate);
router.get('/', asyncHandler(maintenanceController.list));
router.post('/:id/fulfill', asyncHandler(maintenanceController.fulfill));
router.post('/:id/cancel', asyncHandler(maintenanceController.cancel));

export default router;
