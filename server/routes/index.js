import { Router } from 'express';
import authRoutes from './authRoutes.js';
import clientRoutes from './clientRoutes.js';
import vehicleRoutes from './vehicleRoutes.js';
import userRoutes from './userRoutes.js';

// Agrupa las rutas de la API bajo /api. Cada módulo agrega su router aquí.
const router = Router();

router.use('/auth', authRoutes);
router.use('/clients', clientRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/users', userRoutes);

router.get('/health', (req, res) => {
  res.json({ data: { status: 'ok' } });
});

export default router;
