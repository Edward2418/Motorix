import * as userService from '../services/userService.js';
import { validateUserCreate, validateUserListQuery, validateUserUpdate } from '../validators/userValidator.js';
import { parseId, validateStatusBody } from '../validators/common.js';
import { sendData, sendPage } from '../utils/response.js';

const userId = (req) => parseId(req.params.id, 'El identificador del usuario');

export async function list(req, res) {
  sendPage(res, await userService.listUsers(validateUserListQuery(req.query)));
}

export async function get(req, res) {
  sendData(res, await userService.getUser(userId(req)));
}

export async function create(req, res) {
  sendData(res, await userService.createUser(validateUserCreate(req.body)), 201);
}

export async function update(req, res) {
  const id = userId(req);
  sendData(res, await userService.updateUser(id, validateUserUpdate(req.body)));
}

export async function setStatus(req, res) {
  const id = userId(req);
  const active = validateStatusBody(req.body);
  sendData(res, await userService.setUserStatus(id, active, req.user.id));
}
