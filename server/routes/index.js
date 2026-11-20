import { Router } from 'express';
import authRoutes from './authRoutes.js';
import clientRoutes from './clientRoutes.js';
import vehicleRoutes from './vehicleRoutes.js';
import userRoutes from './userRoutes.js';
import orderRoutes from './orderRoutes.js';
import mechanicRoutes from './mechanicRoutes.js';
import appointmentRoutes from './appointmentRoutes.js';
import partRoutes from './partRoutes.js';
import maintenanceRoutes from './maintenanceRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import clientNoticeRoutes from './clientNoticeRoutes.js';
import settingsRoutes from './settingsRoutes.js';
import auditRoutes from './auditRoutes.js';
import termsRoutes from './termsRoutes.js';
import serviceTypeRoutes from './serviceTypeRoutes.js';
import reportRoutes from './reportRoutes.js';

// Agrupa las rutas de la API bajo /api. Cada módulo agrega su router aquí.
const router = Router();

router.use('/auth', authRoutes);
router.use('/clients', clientRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/users', userRoutes);
router.use('/orders', orderRoutes);
router.use('/mechanics', mechanicRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/parts', partRoutes);
router.use('/maintenance', maintenanceRoutes);
router.use('/payments', paymentRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/notifications', notificationRoutes);
router.use('/client-notices', clientNoticeRoutes);
router.use('/settings', settingsRoutes);
router.use('/audit-log', auditRoutes);
router.use('/terms', termsRoutes);
router.use('/service-types', serviceTypeRoutes);
router.use('/reports', reportRoutes);

router.get('/health', (req, res) => {
  res.json({ data: { status: 'ok' } });
});

export default router;
