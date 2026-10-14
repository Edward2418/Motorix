-- Tickets de ejemplo (Sprint 4) de las dos órdenes entregadas. `order_total` es el total vigente de cada orden
-- (servicios + mano de obra + refacciones), así que no muestran el aviso de orden modificada.
-- Idempotente: un ticket por orden. Requiere los seeds 001, 005 y 006.

INSERT INTO tickets (folio, order_id, order_total, generated_by)
SELECT t.folio, o.id,
       (SELECT COALESCE(SUM(s.cost), 0) FROM order_services s WHERE s.order_id = o.id)
       + (SELECT COALESCE(SUM(l.amount), 0) FROM order_labor l WHERE l.order_id = o.id)
       + (SELECT COALESCE(SUM(p.quantity * p.unit_price), 0) FROM order_parts p WHERE p.order_id = o.id),
       a.id
FROM (
  SELECT 'TK-2026-0001' AS folio, 'OS-2026-0001' AS order_folio
  UNION ALL SELECT 'TK-2026-0002', 'OS-2026-0002'
) AS t
JOIN service_orders o ON o.folio = t.order_folio
JOIN users a ON a.username = 'admin'
WHERE NOT EXISTS (SELECT 1 FROM tickets x WHERE x.order_id = o.id);

-- El contador de folios queda en el mayor consecutivo de 2026 (sin retroceder si ya hay más tickets).
INSERT INTO ticket_folio_counters (year, last_number)
SELECT 2026, COUNT(*) FROM tickets WHERE folio LIKE 'TK-2026-%'
ON DUPLICATE KEY UPDATE last_number = GREATEST(last_number, VALUES(last_number));
