import { query } from '../config/db.js';

// Folio del ticket con el formato TK-AAAA-NNNN. Con más de 9999 tickets en un año el consecutivo crece sin truncarse.
export function formatTicketFolio(year, number) {
  return `TK-${year}-${String(number).padStart(4, '0')}`;
}

// Siguiente folio del año. Debe ejecutarse dentro de la transacción que crea el ticket: el contador se incrementa de
// forma atómica, así que dos tickets simultáneos nunca repiten folio y un folio nunca se reutiliza.
export async function nextTicketFolio(conn, date = new Date()) {
  const year = date.getFullYear();
  const result = await query(
    `INSERT INTO ticket_folio_counters (year, last_number) VALUES (?, LAST_INSERT_ID(1))
     ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)`,
    [year],
    conn
  );
  return formatTicketFolio(year, result.insertId);
}
