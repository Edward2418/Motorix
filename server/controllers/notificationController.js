import { notificationService } from '../services/notificationService.js';
import { validateReadBody } from '../validators/notificationValidator.js';
import { sendData } from '../utils/response.js';

// Avisos del usuario autenticado, agrupados por tipo. El servicio filtra por rol: cada quien recibe solo los suyos.
export async function getCenter(req, res) {
  sendData(res, await notificationService.getCenter(req.user));
}

// Solo el total de avisos no leídos (consulta ligera para el contador del encabezado).
export async function getCount(req, res) {
  sendData(res, { unread: await notificationService.getUnreadCount(req.user) });
}

// Marca un aviso como leído para el usuario autenticado. Responde la clave, `read: true` y el total de no leídos.
export async function markRead(req, res) {
  const { key } = validateReadBody(req.body);
  sendData(res, await notificationService.markRead(req.user, key));
}
