import * as authService from '../services/authService.js';
import { validateChangePassword, validateLogin } from '../validators/authValidator.js';
import { sendData, sendNoContent } from '../utils/response.js';

export async function login(req, res) {
  const credentials = validateLogin(req.body);
  sendData(res, await authService.login(credentials));
}

export async function me(req, res) {
  sendData(res, await authService.getCurrentUser(req.user.id));
}

export async function changePassword(req, res) {
  const passwords = validateChangePassword(req.body);
  await authService.changePassword(req.user.id, passwords);
  sendNoContent(res);
}
