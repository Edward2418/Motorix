import { query } from '../config/db.js';

// Servicios realizados (order_services.cost) y mano de obra (order_labor.amount) de una orden.
// En la API ambos importes se llaman `amount`.

const toLine = (row) => ({ id: row.id, description: row.description, amount: Number(row.amount) });

// Un servicio, además, puede estar ligado a un tipo del catálogo (Sprint 7); la mano de obra no.
const toServiceLine = (row) => ({
  ...toLine(row),
  serviceTypeId: row.service_type_id ?? null,
  serviceTypeName: row.service_type_name ?? null
});

export async function listServices(orderId, conn) {
  const rows = await query(
    `SELECT s.id, s.description, s.cost AS amount, s.service_type_id, t.name AS service_type_name
     FROM order_services s
     LEFT JOIN service_types t ON t.id = s.service_type_id
     WHERE s.order_id = ?
     ORDER BY s.id`,
    [orderId],
    conn
  );
  return rows.map(toServiceLine);
}

export async function listLabor(orderId, conn) {
  const rows = await query(
    'SELECT id, description, amount FROM order_labor WHERE order_id = ? ORDER BY id',
    [orderId],
    conn
  );
  return rows.map(toLine);
}

// Cada tipo de línea vive en su tabla: los servicios guardan el importe en `cost` y la mano de obra en `amount`.
const LINE_TABLES = Object.freeze({
  services: { table: 'order_services', column: 'cost' },
  labor: { table: 'order_labor', column: 'amount' }
});

function lineTable(kind) {
  const config = LINE_TABLES[kind];
  if (!config) {
    throw new Error(`Tipo de línea desconocido: ${kind}`);
  }
  return config;
}

// Línea de una orden concreta (null si no existe o pertenece a otra orden).
export async function findLine(kind, orderId, lineId, conn) {
  const { table, column } = lineTable(kind);
  const typeColumn = kind === 'services' ? ', service_type_id' : '';
  const rows = await query(
    `SELECT id, description, ${column} AS amount${typeColumn} FROM ${table} WHERE id = ? AND order_id = ? LIMIT 1`,
    [lineId, orderId],
    conn
  );
  if (!rows[0]) {
    return null;
  }
  return kind === 'services' ? toServiceLine(rows[0]) : toLine(rows[0]);
}

// `serviceTypeId` solo aplica a los servicios: indefinido o `null` la deja sin tipo y un número la liga al tipo.
export async function insertLine(kind, orderId, { description, amount, serviceTypeId }, conn) {
  const { table, column } = lineTable(kind);
  if (kind === 'services') {
    const result = await query(
      `INSERT INTO ${table} (order_id, description, ${column}, service_type_id) VALUES (?, ?, ?, ?)`,
      [orderId, description, amount, serviceTypeId ?? null],
      conn
    );
    return result.insertId;
  }
  const result = await query(
    `INSERT INTO ${table} (order_id, description, ${column}) VALUES (?, ?, ?)`,
    [orderId, description, amount],
    conn
  );
  return result.insertId;
}

// En un servicio, `serviceTypeId` indefinido no toca el tipo, `null` lo quita y un número lo cambia.
export async function updateLine(kind, orderId, lineId, { description, amount, serviceTypeId }, conn) {
  const { table, column } = lineTable(kind);
  if (kind === 'services' && serviceTypeId !== undefined) {
    await query(
      `UPDATE ${table} SET description = ?, ${column} = ?, service_type_id = ? WHERE id = ? AND order_id = ?`,
      [description, amount, serviceTypeId, lineId, orderId],
      conn
    );
    return;
  }
  await query(
    `UPDATE ${table} SET description = ?, ${column} = ? WHERE id = ? AND order_id = ?`,
    [description, amount, lineId, orderId],
    conn
  );
}

// Quita una línea (nunca la orden): el filtro por order_id evita tocar líneas de otras órdenes.
export async function deleteLine(kind, orderId, lineId, conn) {
  const { table } = lineTable(kind);
  await query(`DELETE FROM ${table} WHERE id = ? AND order_id = ?`, [lineId, orderId], conn);
}
