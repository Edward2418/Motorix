import * as partService from '../services/partService.js';
import { validatePartCreate, validatePartListQuery, validatePartUpdate } from '../validators/partValidator.js';
import { parseId, validateStatusBody } from '../validators/common.js';
import { sendData, sendPage } from '../utils/response.js';

const partId = (req) => parseId(req.params.id, 'El identificador de la refacción');

export async function list(req, res) {
  sendPage(res, await partService.listParts(validatePartListQuery(req.query), req.user));
}

export async function categories(req, res) {
  sendData(res, await partService.listCategories(req.user));
}

export async function get(req, res) {
  sendData(res, await partService.getPart(partId(req), req.user));
}

export async function create(req, res) {
  sendData(res, await partService.createPart(validatePartCreate(req.body), req.user), 201);
}

export async function update(req, res) {
  const id = partId(req);
  sendData(res, await partService.updatePart(id, validatePartUpdate(req.body), req.user));
}

export async function setStatus(req, res) {
  const id = partId(req);
  sendData(res, await partService.setPartActive(id, validateStatusBody(req.body), req.user));
}
