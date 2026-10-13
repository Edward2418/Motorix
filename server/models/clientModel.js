import { query } from '../config/db.js';
import { likePattern } from '../validators/common.js';

const CLIENT_SELECT = `
  SELECT c.id, c.name, c.phone, c.email, c.active, c.created_at, c.updated_at,
         (SELECT COUNT(*) FROM vehicles v WHERE v.client_id = c.id AND v.active = 1) AS vehicle_count
  FROM clients c`;

// Convierte una fila SQL en el objeto público de la API (camelCase).
export function toClient(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    active: Boolean(row.active),
    vehicleCount: Number(row.vehicle_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Listado paginado con búsqueda por nombre, teléfono o correo y filtro por estado.
export async function list({ search, active, page, pageSize }) {
  const conditions = [];
  const params = [];
  if (search) {
    const pattern = likePattern(search);
    conditions.push('(c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)');
    params.push(pattern, pattern, pattern);
  }
  if (active !== 'all') {
    conditions.push('c.active = ?');
    params.push(active === 'true' ? 1 : 0);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM clients c ${where}`, params);
  const rows = await query(`${CLIENT_SELECT} ${where} ORDER BY c.name, c.id LIMIT ? OFFSET ?`, [
    ...params,
    pageSize,
    (page - 1) * pageSize
  ]);
  return { items: rows.map(toClient), total: Number(total) };
}

export async function findById(id) {
  const rows = await query(`${CLIENT_SELECT} WHERE c.id = ? LIMIT 1`, [id]);
  return toClient(rows[0]);
}

export async function create({ name, phone, email }) {
  const result = await query('INSERT INTO clients (name, phone, email) VALUES (?, ?, ?)', [name, phone, email]);
  return findById(result.insertId);
}

export async function update(id, { name, phone, email }) {
  await query('UPDATE clients SET name = ?, phone = ?, email = ? WHERE id = ?', [name, phone, email, id]);
  return findById(id);
}

export async function updateStatus(id, active) {
  await query('UPDATE clients SET active = ? WHERE id = ?', [active ? 1 : 0, id]);
  return findById(id);
}
