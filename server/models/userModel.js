import { query } from '../config/db.js';
import { likePattern } from '../validators/common.js';

const PUBLIC_COLUMNS = 'id, username, name, email, role, active, created_at, updated_at';

// Convierte una fila SQL (snake_case) en el objeto público de la API (camelCase), sin el hash.
export function toUser(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    email: row.email,
    role: row.role,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Busca por correo (si el valor contiene "@") o por nombre de usuario. Incluye el hash para autenticar.
export async function findAuthByIdentifier(identifier) {
  const value = identifier.trim();
  const column = value.includes('@') ? 'email' : 'username';
  const rows = await query(`SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE ${column} = ? LIMIT 1`, [value]);
  return rows[0] ?? null;
}

export async function findAuthById(id) {
  const rows = await query(`SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE id = ? LIMIT 1`, [id]);
  return rows[0] ?? null;
}

export async function findById(id) {
  const rows = await query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ? LIMIT 1`, [id]);
  return toUser(rows[0]);
}

export async function updatePassword(id, passwordHash) {
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
}

// Listado paginado con búsqueda por usuario, nombre o correo y filtro por estado.
export async function list({ search, active, page, pageSize }) {
  const conditions = [];
  const params = [];
  if (search) {
    const pattern = likePattern(search);
    conditions.push('(username LIKE ? OR name LIKE ? OR email LIKE ?)');
    params.push(pattern, pattern, pattern);
  }
  if (active !== 'all') {
    conditions.push('active = ?');
    params.push(active === 'true' ? 1 : 0);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM users ${where}`, params);
  const rows = await query(`SELECT ${PUBLIC_COLUMNS} FROM users ${where} ORDER BY username, id LIMIT ? OFFSET ?`, [
    ...params,
    pageSize,
    (page - 1) * pageSize
  ]);
  return { items: rows.map(toUser), total: Number(total) };
}

export async function findByUsername(username) {
  const rows = await query('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
  return rows[0] ?? null;
}

export async function findByEmail(email) {
  const rows = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  return rows[0] ?? null;
}

export async function create({ username, name, email, passwordHash, role }) {
  const result = await query(
    'INSERT INTO users (username, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    [username, name, email, passwordHash, role]
  );
  return findById(result.insertId);
}

export async function update(id, { name, email, role }) {
  await query('UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?', [name, email, role, id]);
  return findById(id);
}

export async function updateStatus(id, active) {
  await query('UPDATE users SET active = ? WHERE id = ?', [active ? 1 : 0, id]);
  return findById(id);
}

// Mecánicos activos con la cantidad de órdenes abiertas que tienen asignadas.
export async function listActiveMechanics() {
  const rows = await query(
    `SELECT u.id, u.name,
            (SELECT COUNT(*) FROM service_orders o
             WHERE o.mechanic_id = u.id AND o.status NOT IN ('ENTREGADO','CANCELADA')) AS open_orders
     FROM users u
     WHERE u.role = 'MECHANIC' AND u.active = 1
     ORDER BY u.name, u.id`
  );
  return rows.map((row) => ({ id: row.id, name: row.name, openOrders: Number(row.open_orders) }));
}

export async function countActiveAdmins() {
  const [{ total }] = await query("SELECT COUNT(*) AS total FROM users WHERE role = 'ADMIN' AND active = 1");
  return Number(total);
}
