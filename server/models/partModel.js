import { query } from '../config/db.js';
import { levelOf } from '../services/stockRules.js';
import { likePattern } from '../validators/common.js';

const money = (value) => Math.round(Number(value) * 100) / 100;

// Convierte una fila SQL en el objeto de la API. El precio de compra solo se incluye para la administración.
export function toPart(row, { includePurchasePrice = true } = {}) {
  if (!row) {
    return null;
  }
  const part = {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    brand: row.brand,
    stock: row.stock,
    minStock: row.min_stock,
    stockLevel: levelOf({ stock: row.stock, minStock: row.min_stock }),
    salePrice: money(row.sale_price),
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
  if (includePurchasePrice) {
    part.purchasePrice = money(row.purchase_price);
  }
  return part;
}

const PART_SELECT = `
  SELECT id, code, name, category, brand, stock, min_stock, purchase_price, sale_price, active, created_at, updated_at
  FROM parts`;

export async function findById(id, conn) {
  const rows = await query(`${PART_SELECT} WHERE id = ? LIMIT 1`, [id], conn);
  return rows[0] ?? null;
}

export async function findByCode(code, conn) {
  const rows = await query(`${PART_SELECT} WHERE code = ? LIMIT 1`, [code], conn);
  return rows[0] ?? null;
}

// Bloquea la refacción dentro de una transacción antes de cambiar su stock.
export async function lockById(id, conn) {
  const rows = await query(`${PART_SELECT} WHERE id = ? FOR UPDATE`, [id], conn);
  return rows[0] ?? null;
}

// Bloquea varias refacciones siempre ordenadas por id, para que transacciones simultáneas no se bloqueen entre sí.
export async function lockMany(ids, conn) {
  if (ids.length === 0) {
    return [];
  }
  return query(`${PART_SELECT} WHERE id IN (?) ORDER BY id FOR UPDATE`, [ids], conn);
}

// Condiciones del listado. `lowStock` solo considera refacciones activas, igual que las alertas.
function buildFilters({ q, category, active, stockLevel, lowStock }) {
  const conditions = [];
  const params = [];
  if (q) {
    const pattern = likePattern(q);
    conditions.push('(code LIKE ? OR name LIKE ? OR brand LIKE ?)');
    params.push(pattern, pattern, pattern);
  }
  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }
  if (active !== undefined) {
    conditions.push('active = ?');
    params.push(active ? 1 : 0);
  }
  if (stockLevel === 'AGOTADO') {
    conditions.push('stock = 0');
  } else if (stockLevel === 'BAJO') {
    conditions.push('stock > 0 AND stock <= min_stock');
  } else if (stockLevel === 'NORMAL') {
    conditions.push('stock > min_stock');
  }
  if (lowStock) {
    conditions.push('active = 1 AND stock <= min_stock');
  }
  return { where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

export async function list(filters, { page, pageSize }) {
  const { where, params } = buildFilters(filters);
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM parts ${where}`, params);
  const rows = await query(`${PART_SELECT} ${where} ORDER BY name, id LIMIT ? OFFSET ?`, [
    ...params,
    pageSize,
    (page - 1) * pageSize
  ]);
  return { rows, total: Number(total) };
}

// Refacciones activas con stock igual o menor al mínimo: primero las agotadas y luego las de menor existencia.
export async function listAlerts() {
  return query(`${PART_SELECT} WHERE active = 1 AND stock <= min_stock ORDER BY stock = 0 DESC, stock, name, id`);
}

export async function listCategories({ activeOnly = false } = {}) {
  const rows = await query(
    `SELECT DISTINCT category FROM parts ${activeOnly ? 'WHERE active = 1' : ''} ORDER BY category`
  );
  return rows.map((row) => row.category);
}

export async function insert(data, conn) {
  const result = await query(
    `INSERT INTO parts (code, name, category, brand, stock, min_stock, purchase_price, sale_price)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.code, data.name, data.category, data.brand, data.stock ?? 0, data.minStock, data.purchasePrice, data.salePrice],
    conn
  );
  return result.insertId;
}

const UPDATE_COLUMNS = Object.freeze({
  code: 'code',
  name: 'name',
  category: 'category',
  brand: 'brand',
  minStock: 'min_stock',
  purchasePrice: 'purchase_price',
  salePrice: 'sale_price'
});

// Actualiza solo los campos enviados. Nunca toca el stock: ese cambia únicamente mediante movimientos.
export async function update(id, fields, conn) {
  const keys = Object.keys(fields).filter((key) => UPDATE_COLUMNS[key]);
  if (keys.length === 0) {
    return;
  }
  const assignments = keys.map((key) => `${UPDATE_COLUMNS[key]} = ?`).join(', ');
  await query(`UPDATE parts SET ${assignments} WHERE id = ?`, [...keys.map((key) => fields[key]), id], conn);
}

export async function setActive(id, active, conn) {
  await query('UPDATE parts SET active = ? WHERE id = ?', [active ? 1 : 0, id], conn);
}

// Fija el stock (la refacción debe estar bloqueada en la misma transacción).
export async function applyStock(id, newStock, conn) {
  await query('UPDATE parts SET stock = ? WHERE id = ?', [newStock, id], conn);
}

// Baja el stock solo si alcanza (defensa contra carreras). Devuelve true si se aplicó.
export async function decrementIfEnough(id, quantity, conn) {
  const result = await query('UPDATE parts SET stock = stock - ? WHERE id = ? AND stock >= ?', [quantity, id, quantity], conn);
  return result.affectedRows === 1;
}
