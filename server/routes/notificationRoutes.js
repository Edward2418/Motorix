import { Router } from 'express';
import * as notificationController from '../controllers/notificationController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Los tres roles consultan sus avisos; qué tipos recibe cada rol lo decide el servicio en el servidor.
// Los avisos no se guardan, así que no existe ninguna ruta para crearlos ni eliminarlos.
router.use(authenticate);
router.get('/', asyncHandler(notificationController.getCenter));
router.get('/count', asyncHandler(notificationController.getCount));
router.post('/read', asyncHandler(notificationController.markRead));

export default router;
