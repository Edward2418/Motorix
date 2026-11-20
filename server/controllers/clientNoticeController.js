import * as clientNoticeService from '../services/clientNoticeService.js';
import { validateNoticeBody } from '../validators/notificationValidator.js';
import { sendData } from '../utils/response.js';

// Hechos que recepción debe avisar a los clientes. Responde la lista con el total en `meta`.
export async function list(_req, res) {
  const data = await clientNoticeService.listPending();
  res.status(200).json({ data, meta: { total: data.length } });
}

// Registra que se avisó a un cliente por un hecho concreto (quién y cuándo salen del usuario autenticado).
export async function register(req, res) {
  sendData(res, await clientNoticeService.register(validateNoticeBody(req.body), req.user), 201);
}
