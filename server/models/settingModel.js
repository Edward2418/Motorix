import { query } from '../config/db.js';

// Configuración del taller guardada (Sprint 7). Pares clave y valor: la lista de claves permitidas y sus límites viven
// en services/settingsRules.js. La tabla puede estar vacía: entonces se usan los valores del servidor o los predeterminados.

/** Todas las filas guardadas: `[{ key, value, updatedBy, updatedByName, updatedAt }]`. */
export async function listAll(conn) {
  const rows = await query(
    `SELECT s.setting_key, s.setting_value, s.updated_by, u.name AS updated_by_name, s.updated_at
     FROM settings s
     JOIN users u ON u.id = s.updated_by
     ORDER BY s.setting_key`,
    [],
    conn
  );
  return rows.map((row) => ({
    key: row.setting_key,
    value: row.setting_value,
    updatedBy: row.updated_by,
    updatedByName: row.updated_by_name,
    updatedAt: row.updated_at
  }));
}

/** Guarda varias claves a la vez (`entries`: `[{ key, value }]`). Pásale la conexión de una transacción para que sea todo o nada. */
export async function saveMany(entries, updatedBy, conn) {
  for (const { key, value } of entries) {
    await query(
      `INSERT INTO settings (setting_key, setting_value, updated_by)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
      [key, String(value), updatedBy],
      conn
    );
  }
}
