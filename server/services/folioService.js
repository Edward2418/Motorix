import { query } from '../config/db.js';

// Genera el siguiente folio del año, con el formato OS-AAAA-NNNN.
// Debe ejecutarse dentro de la transacción de creación de la orden (recibe su conexión):
// el contador se incrementa de forma atómica, así que dos órdenes simultáneas nunca repiten folio
// y un folio nunca se reutiliza, aunque la orden se cancele.
export async function nextFolio(conn, date = new Date()) {
  const year = date.getFullYear();
  const result = await query(
    `INSERT INTO folio_counters (year, last_number) VALUES (?, LAST_INSERT_ID(1))
     ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)`,
    [year],
    conn
  );
  // Con INSERT ... ON DUPLICATE KEY UPDATE, insertId trae el valor de LAST_INSERT_ID(expr).
  return formatFolio(year, result.insertId);
}

export function formatFolio(year, number) {
  return `OS-${year}-${String(number).padStart(4, '0')}`;
}
