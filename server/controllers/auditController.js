import { auditService } from '../services/auditService.js';
import { validateAuditQuery } from '../validators/auditValidator.js';
import { sendPage } from '../utils/response.js';

export async function list(req, res) {
  const filters = validateAuditQuery(req.query);
  const { data, total } = await auditService.list(filters);
  sendPage(res, { data, page: filters.page, pageSize: filters.pageSize, total });
}
