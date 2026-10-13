import { query } from '../config/db.js';
import { likePattern } from '../validators/common.js';

const VEHICLE_SELECT = `
  SELECT v.id, v.client_id, c.name AS client_name, v.brand, v.model, v.year, v.license_plate, v.vin,
         v.current_mileage, v.active, v.created_at, v.updated_at
  FROM vehicles v
  JOIN clients c ON c.id = v.client_id`;

// Convierte una fila SQL en el objeto público de la API (camelCase).
export function toVehicle(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    brand: row.brand,
    model: row.model,
    year: row.year,
    licensePlate: row.license_plate,
    vin: row.vin,
    currentMileage: row.current_mileage,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Vehículos de un cliente (activos e inactivos), en orden de registro.
export async function listByClient(clientId) {
  const rows = await query(`${VEHICLE_SELECT} WHERE v.client_id = ? ORDER BY v.id`, [clientId]);
  return rows.map(toVehicle);
}

export async function findById(id) {
  const rows = await query(`${VEHICLE_SELECT} WHERE v.id = ? LIMIT 1`, [id]);
  return toVehicle(rows[0]);
}

export async function findByPlate(licensePlate) {
  const rows = await query('SELECT id FROM vehicles WHERE license_plate = ? LIMIT 1', [licensePlate]);
  return rows[0] ?? null;
}

export async function findByVin(vin) {
  const rows = await query('SELECT id FROM vehicles WHERE vin = ? LIMIT 1', [vin]);
  return rows[0] ?? null;
}

// Listado paginado con búsqueda por placa, marca, modelo o nombre del propietario.
export async function list({ search, active, clientId, page, pageSize }) {
  const conditions = [];
  const params = [];
  if (search) {
    const pattern = likePattern(search);
    conditions.push('(v.license_plate LIKE ? OR v.brand LIKE ? OR v.model LIKE ? OR c.name LIKE ?)');
    params.push(pattern, pattern, pattern, pattern);
  }
  if (active !== 'all') {
    conditions.push('v.active = ?');
    params.push(active === 'true' ? 1 : 0);
  }
  if (clientId) {
    conditions.push('v.client_id = ?');
    params.push(clientId);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM vehicles v JOIN clients c ON c.id = v.client_id ${where}`,
    params
  );
  const rows = await query(`${VEHICLE_SELECT} ${where} ORDER BY v.license_plate, v.id LIMIT ? OFFSET ?`, [
    ...params,
    pageSize,
    (page - 1) * pageSize
  ]);
  return { items: rows.map(toVehicle), total: Number(total) };
}

export async function create({ clientId, brand, model, year, licensePlate, vin, currentMileage }) {
  const result = await query(
    `INSERT INTO vehicles (client_id, brand, model, year, license_plate, vin, current_mileage)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [clientId, brand, model, year, licensePlate, vin, currentMileage]
  );
  return findById(result.insertId);
}

export async function updateStatus(id, active) {
  await query('UPDATE vehicles SET active = ? WHERE id = ?', [active ? 1 : 0, id]);
  return findById(id);
}

export async function countActiveByClient(clientId) {
  const [{ total }] = await query('SELECT COUNT(*) AS total FROM vehicles WHERE client_id = ? AND active = 1', [
    clientId
  ]);
  return Number(total);
}
