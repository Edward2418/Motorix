import * as termsService from '../services/termsService.js';
import { validateAcceptancesQuery, validateTermsAccept } from '../validators/termsValidator.js';
import { sendData, sendPage } from '../utils/response.js';

export async function current(req, res) {
  sendData(res, await termsService.getCurrent(req.user.id));
}

export async function accept(req, res) {
  const { version } = validateTermsAccept(req.body);
  sendData(res, await termsService.accept(req.user.id, version));
}

export async function acceptances(req, res) {
  const filters = validateAcceptancesQuery(req.query);
  const { data, total } = await termsService.listAcceptances(filters);
  sendPage(res, { data, page: filters.page, pageSize: filters.pageSize, total });
}
