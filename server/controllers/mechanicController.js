import * as userModel from '../models/userModel.js';
import { sendData } from '../utils/response.js';

// Mecánicos activos con su cantidad de órdenes abiertas, para elegir a quién asignar una orden.
export async function list(req, res) {
  sendData(res, await userModel.listActiveMechanics());
}
