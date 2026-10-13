import * as clientService from '../services/clientService.js';
import { validateClientInput, validateClientListQuery } from '../validators/clientValidator.js';
import { parseId, validateStatusBody } from '../validators/common.js';
import { sendData, sendPage } from '../utils/response.js';

export async function list(req, res) {
  const filters = validateClientListQuery(req.query);
  sendPage(res, await clientService.listClients(filters));
}

export async function get(req, res) {
  sendData(res, await clientService.getClient(parseId(req.params.id, 'El identificador del cliente')));
}

export async function create(req, res) {
  const input = validateClientInput(req.body);
  sendData(res, await clientService.createClient(input), 201);
}

export async function update(req, res) {
  const id = parseId(req.params.id, 'El identificador del cliente');
  sendData(res, await clientService.updateClient(id, validateClientInput(req.body)));
}

export async function setStatus(req, res) {
  const id = parseId(req.params.id, 'El identificador del cliente');
  const active = validateStatusBody(req.body);
  sendData(res, await clientService.setClientStatus(id, active));
}
