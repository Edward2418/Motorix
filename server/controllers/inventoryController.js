import * as inventoryService from '../services/inventoryService.js';
import { validateMovementCreate } from '../validators/movementValidator.js';
import { parseId, parsePagination } from '../validators/common.js';
import { sendData, sendPage } from '../utils/response.js';

const partId = (req) => parseId(req.params.id, 'El identificador de la refacción');

export async function listMovements(req, res) {
  const id = partId(req);
  sendPage(res, await inventoryService.listMovements(id, parsePagination(req.query)));
}

export async function createMovement(req, res) {
  const id = partId(req);
  sendData(res, await inventoryService.createMovement(id, validateMovementCreate(req.body), req.user), 201);
}
