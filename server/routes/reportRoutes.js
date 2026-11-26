import { Router } from 'express';
import * as reportController from '../controllers/reportController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize, ROLES } from '../middlewares/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Los reportes son solo de lectura y solo para administración (se valida aquí, en el servidor). No hay rutas que escriban.
const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN));
router.get('/income', asyncHandler(reportController.income));
router.get('/services', asyncHandler(reportController.services));
router.get('/productivity', asyncHandler(reportController.productivity));
router.get('/parts-margin', asyncHandler(reportController.partsMargin));
router.get('/inventory-turnover', asyncHandler(reportController.inventoryTurnover));

export default router;
