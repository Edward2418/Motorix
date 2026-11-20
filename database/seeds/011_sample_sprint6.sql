-- Datos de ejemplo del Sprint 6 (notificaciones internas): completa lo que los seeds anteriores no tenían para que el
-- centro de avisos muestre los seis tipos al arrancar.
--   Ya existen en los seeds anteriores (no se repiten aquí): citas de hoy y de mañana (004), refacciones con stock bajo,
--   en su mínimo y agotadas (006), mantenimientos próximos y vencidos (007) y órdenes terminadas sin entregar (008 de la
--   orden OS-2026-0008, y 010 de OS-2026-0009 y OS-2026-0010).
--   Nuevo: OS-2026-0011, una orden en DIAGNOSTICO asignada a «mecanico» cuyo último cambio fue hace 5 días (orden
--   detenida), y un aviso ya hecho a un cliente (la orden terminada OS-2026-0008) para ver el historial de quién avisó.
-- Idempotente: la orden se identifica por su folio, su historial se inserta una sola vez y el aviso al cliente solo si
-- ese hecho todavía no tiene registro. Las fechas son relativas a NOW(), así que el estado se mantiene al repetir el seed.
-- Requiere los seeds 001 (usuarios), 003 (vehículos) y 005 (órdenes).

INSERT INTO service_orders
  (folio, client_id, vehicle_id, mechanic_id, appointment_id, entry_mileage, previous_mileage, reported_problem,
   diagnosis, notes, recommendations, status, cancel_reason, delivered_at, created_by, created_at)
SELECT 'OS-2026-0011', v.client_id, v.id, m.id, NULL, v.current_mileage, v.current_mileage,
       'Ruido al frenar y pedal esponjoso', NULL, 'Pendiente de revisar las balatas y el nivel de líquido', NULL,
       'DIAGNOSTICO', NULL, NULL, r.id, DATE_SUB(NOW(), INTERVAL 123 HOUR)
FROM vehicles v
JOIN users m ON m.username = 'mecanico'
JOIN users r ON r.username = 'recepcion'
WHERE v.license_plate = 'AST9067'
  AND NOT EXISTS (SELECT 1 FROM service_orders o WHERE o.folio = 'OS-2026-0011');

-- El último cambio de estado (DIAGNOSTICO) es de hace 5 días: pasa de los 3 días del aviso de orden detenida.
INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, reason, changed_at)
SELECT o.id, d.from_status, d.to_status, u.id, NULL, d.changed_at
FROM (
  SELECT NULL AS from_status, 'RECIBIDO' AS to_status, 'recepcion' AS changed_by, DATE_SUB(NOW(), INTERVAL 123 HOUR) AS changed_at
  UNION ALL SELECT 'RECIBIDO', 'DIAGNOSTICO', 'mecanico', DATE_SUB(NOW(), INTERVAL 120 HOUR)
) AS d
JOIN service_orders o ON o.folio = 'OS-2026-0011'
JOIN users u ON u.username = d.changed_by
WHERE NOT EXISTS (SELECT 1 FROM order_status_history h WHERE h.order_id = o.id);

-- Reserva el folio usado para que las órdenes nuevas continúen la numeración.
INSERT INTO folio_counters (year, last_number) VALUES (2026, 11)
ON DUPLICATE KEY UPDATE last_number = GREATEST(last_number, 11);

-- Un cliente ya avisado: la orden terminada OS-2026-0008 no aparece en «Clientes por avisar», pero queda registrado
-- quién avisó y cuándo (las otras órdenes terminadas, las citas y los mantenimientos siguen pendientes).
INSERT INTO client_notices (client_id, reason, fact_key, note, notified_by, notified_at)
SELECT o.client_id, 'ORDEN_TERMINADA', CONCAT('ORDER:', o.id), 'Se avisó por teléfono, pasa por el vehículo mañana',
       u.id, DATE_SUB(NOW(), INTERVAL 2 HOUR)
FROM service_orders o
JOIN users u ON u.username = 'recepcion'
WHERE o.folio = 'OS-2026-0008'
  AND NOT EXISTS (
    SELECT 1 FROM client_notices n WHERE n.reason = 'ORDEN_TERMINADA' AND n.fact_key = CONCAT('ORDER:', o.id)
  );
