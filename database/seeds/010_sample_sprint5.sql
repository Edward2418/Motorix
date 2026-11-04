-- Datos de ejemplo del Sprint 5 (precios de refacciones y cobro completo): dos órdenes terminadas con refacciones.
--   OS-2026-0009: cobrable por su total, sin pagos y sin ticket (se cobra y se emite su ticket en la demostración).
--   OS-2026-0010: con un ticket (TK-2026-0003) que ya guarda su contenido, sin pagos.
-- Los pagos y tickets de los seeds 008 y 009 no se tocan: siguen sin total de creación y sin contenido guardado.
-- Las fechas son de las últimas 11 horas para que sus movimientos de inventario sean los más recientes de cada pieza.
-- Idempotente: cada orden se identifica por su folio; cada línea, movimiento, historial y ticket se inserta una sola vez,
-- y el stock de las refacciones se recalcula siempre como la suma de sus movimientos.
-- Requiere los seeds 001 (usuarios), 003 (vehículos), 005 (órdenes), 006 (refacciones) y 009 (tickets).

INSERT INTO service_orders
  (folio, client_id, vehicle_id, mechanic_id, appointment_id, entry_mileage, previous_mileage, reported_problem,
   diagnosis, notes, recommendations, status, cancel_reason, delivered_at, created_by, created_at)
SELECT d.folio, v.client_id, v.id, m.id, NULL, d.entry_mileage, d.previous_mileage, d.reported_problem,
       d.diagnosis, NULL, d.recommendations, 'TERMINADO', NULL, NULL, r.id, d.created_at
FROM (
  SELECT 'OS-2026-0009' AS folio, 'MFL2210' AS plate, 'mecanico' AS mechanic, 31850 AS entry_mileage,
         31800 AS previous_mileage, 'Mantenimiento de los 32,000 km' AS reported_problem,
         'Aceite y filtros vencidos, bujías con desgaste normal' AS diagnosis,
         'Próximo cambio de aceite a los 37,000 km' AS recommendations, DATE_SUB(NOW(), INTERVAL 11 HOUR) AS created_at
  UNION ALL SELECT 'OS-2026-0010', 'JTT8830', 'mecanico2', 112450, 112400, 'No enciende por las mañanas',
         'Batería sin carga, el alternador carga bien', 'Revisar la batería en seis meses', DATE_SUB(NOW(), INTERVAL 10 HOUR)
) AS d
JOIN vehicles v ON v.license_plate = d.plate
JOIN users m ON m.username = d.mechanic
JOIN users r ON r.username = 'recepcion'
WHERE NOT EXISTS (SELECT 1 FROM service_orders o WHERE o.folio = d.folio);

INSERT INTO order_services (order_id, description, cost)
SELECT o.id, d.description, d.amount
FROM (
  SELECT 'OS-2026-0009' AS folio, 'Cambio de aceite y filtros' AS description, 850.00 AS amount
  UNION ALL SELECT 'OS-2026-0010', 'Instalación de batería', 300.00
) AS d
JOIN service_orders o ON o.folio = d.folio
WHERE NOT EXISTS (SELECT 1 FROM order_services t WHERE t.order_id = o.id AND t.description = d.description);

INSERT INTO order_labor (order_id, description, amount)
SELECT o.id, d.description, d.amount
FROM (
  SELECT 'OS-2026-0009' AS folio, 'Mano de obra de mantenimiento' AS description, 450.00 AS amount
  UNION ALL SELECT 'OS-2026-0010', 'Mano de obra eléctrica', 200.00
) AS d
JOIN service_orders o ON o.folio = d.folio
WHERE NOT EXISTS (SELECT 1 FROM order_labor t WHERE t.order_id = o.id AND t.description = d.description);

-- El precio de cada línea es el precio de venta vigente de la refacción (se copia al agregarla).
INSERT INTO order_parts (order_id, part_id, quantity, unit_price, created_at)
SELECT o.id, p.id, d.quantity, p.sale_price, d.created_at
FROM (
  SELECT 'OS-2026-0009' AS folio, 'ACE-5W30-11' AS code, 4 AS quantity, DATE_SUB(NOW(), INTERVAL 10 HOUR) AS created_at
  UNION ALL SELECT 'OS-2026-0009', 'FIL-AIR-03', 1, DATE_SUB(NOW(), INTERVAL 10 HOUR)
  UNION ALL SELECT 'OS-2026-0009', 'BUJ-NGK-01', 4, DATE_SUB(NOW(), INTERVAL 10 HOUR)
  UNION ALL SELECT 'OS-2026-0010', 'BAT-12V-12', 1, DATE_SUB(NOW(), INTERVAL 9 HOUR)
  UNION ALL SELECT 'OS-2026-0010', 'ANT-5L-09', 2, DATE_SUB(NOW(), INTERVAL 9 HOUR)
) AS d
JOIN service_orders o ON o.folio = d.folio
JOIN parts p ON p.code = d.code
WHERE NOT EXISTS (SELECT 1 FROM order_parts op WHERE op.order_id = o.id AND op.part_id = p.id);

-- Cada uso de una refacción genera su salida de inventario ligada a la orden.
INSERT INTO inventory_movements (part_id, type, quantity, stock_after, reason, order_id, created_by, created_at)
SELECT p.id, 'SALIDA', -op.quantity,
       COALESCE((SELECT SUM(mv.quantity) FROM inventory_movements mv WHERE mv.part_id = p.id), 0) - op.quantity,
       CONCAT('Uso en la orden ', o.folio), o.id, o.mechanic_id, op.created_at
FROM order_parts op
JOIN service_orders o ON o.id = op.order_id
JOIN parts p ON p.id = op.part_id
WHERE o.folio IN ('OS-2026-0009', 'OS-2026-0010')
  AND NOT EXISTS (
    SELECT 1 FROM inventory_movements mv WHERE mv.order_id = o.id AND mv.part_id = p.id AND mv.type = 'SALIDA'
  );

-- El stock actual es siempre la suma de los movimientos.
UPDATE parts p
SET p.stock = (SELECT COALESCE(SUM(m.quantity), 0) FROM inventory_movements m WHERE m.part_id = p.id)
WHERE p.code IN ('ACE-5W30-11', 'FIL-AIR-03', 'BUJ-NGK-01', 'BAT-12V-12', 'ANT-5L-09');

INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, reason, changed_at)
SELECT o.id, d.from_status, d.to_status, u.id, NULL, DATE_SUB(NOW(), INTERVAL d.hours HOUR)
FROM (
  SELECT 'OS-2026-0009' AS folio, NULL AS from_status, 'RECIBIDO' AS to_status, 'recepcion' AS changed_by, 11 AS hours
  UNION ALL SELECT 'OS-2026-0009', 'RECIBIDO', 'DIAGNOSTICO', 'mecanico', 10
  UNION ALL SELECT 'OS-2026-0009', 'DIAGNOSTICO', 'EN_REPARACION', 'mecanico', 9
  UNION ALL SELECT 'OS-2026-0009', 'EN_REPARACION', 'TERMINADO', 'mecanico', 8
  UNION ALL SELECT 'OS-2026-0010', NULL, 'RECIBIDO', 'recepcion', 10
  UNION ALL SELECT 'OS-2026-0010', 'RECIBIDO', 'DIAGNOSTICO', 'mecanico2', 9
  UNION ALL SELECT 'OS-2026-0010', 'DIAGNOSTICO', 'EN_REPARACION', 'mecanico2', 8
  UNION ALL SELECT 'OS-2026-0010', 'EN_REPARACION', 'TERMINADO', 'mecanico2', 6
) AS d
JOIN service_orders o ON o.folio = d.folio
JOIN users u ON u.username = d.changed_by
WHERE NOT EXISTS (SELECT 1 FROM order_status_history h WHERE h.order_id = o.id AND h.to_status = d.to_status);

-- Kilometraje del servicio de las órdenes terminadas (mayor o igual al de entrada) y kilometraje actual del vehículo.
UPDATE service_orders SET service_mileage = entry_mileage + 50
WHERE folio IN ('OS-2026-0009', 'OS-2026-0010') AND (service_mileage IS NULL OR service_mileage = entry_mileage);

UPDATE vehicles v
JOIN service_orders o ON o.vehicle_id = v.id
SET v.current_mileage = GREATEST(v.current_mileage, o.service_mileage)
WHERE o.folio IN ('OS-2026-0009', 'OS-2026-0010') AND o.service_mileage IS NOT NULL;

-- Reserva los folios usados para que las órdenes nuevas continúen la numeración.
INSERT INTO folio_counters (year, last_number) VALUES (2026, 10)
ON DUPLICATE KEY UPDATE last_number = GREATEST(last_number, 10);

-- Ticket de OS-2026-0010 con su contenido guardado al emitirse (conceptos e importes; sin pagos ni estado de la orden).
-- Los datos del taller son los de ejemplo de la configuración del servidor.
INSERT INTO tickets (folio, order_id, order_total, content, generated_by)
SELECT 'TK-2026-0003', o.id,
       (SELECT COALESCE(SUM(s.cost), 0) FROM order_services s WHERE s.order_id = o.id)
       + (SELECT COALESCE(SUM(l.amount), 0) FROM order_labor l WHERE l.order_id = o.id)
       + (SELECT COALESCE(SUM(p.quantity * p.unit_price), 0) FROM order_parts p WHERE p.order_id = o.id),
       JSON_OBJECT(
         'workshop', JSON_OBJECT('name', 'Taller Motorix (ejemplo)', 'address', 'Av. Principal 123, Ciudad de México', 'phone', '55 0000 0000'),
         'order', JSON_OBJECT('id', o.id, 'folio', o.folio),
         'client', JSON_OBJECT('name', c.name, 'phone', c.phone),
         'vehicle', JSON_OBJECT(
           'description', CONCAT(v.brand, ' ', v.model, ' ', v.year),
           'licensePlate', v.license_plate,
           'mileage', COALESCE(o.service_mileage, o.entry_mileage)
         ),
         'services', (
           SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT('description', s.description, 'quantity', 1, 'unitPrice', s.cost, 'amount', s.cost)), JSON_ARRAY())
           FROM order_services s WHERE s.order_id = o.id
         ),
         'labor', (
           SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT('description', l.description, 'quantity', 1, 'unitPrice', l.amount, 'amount', l.amount)), JSON_ARRAY())
           FROM order_labor l WHERE l.order_id = o.id
         ),
         'parts', (
           SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT(
                    'description', CONCAT(p.code, ' · ', p.name), 'quantity', op.quantity,
                    'unitPrice', op.unit_price, 'amount', op.quantity * op.unit_price)), JSON_ARRAY())
           FROM order_parts op JOIN parts p ON p.id = op.part_id WHERE op.order_id = o.id
         ),
         'subtotals', JSON_OBJECT(
           'services', (SELECT COALESCE(SUM(s.cost), 0) FROM order_services s WHERE s.order_id = o.id),
           'labor', (SELECT COALESCE(SUM(l.amount), 0) FROM order_labor l WHERE l.order_id = o.id),
           'parts', (SELECT COALESCE(SUM(p.quantity * p.unit_price), 0) FROM order_parts p WHERE p.order_id = o.id)
         ),
         'total',
           (SELECT COALESCE(SUM(s.cost), 0) FROM order_services s WHERE s.order_id = o.id)
           + (SELECT COALESCE(SUM(l.amount), 0) FROM order_labor l WHERE l.order_id = o.id)
           + (SELECT COALESCE(SUM(p.quantity * p.unit_price), 0) FROM order_parts p WHERE p.order_id = o.id)
       ),
       a.id
FROM service_orders o
JOIN clients c ON c.id = o.client_id
JOIN vehicles v ON v.id = o.vehicle_id
JOIN users a ON a.username = 'admin'
WHERE o.folio = 'OS-2026-0010'
  AND NOT EXISTS (SELECT 1 FROM tickets x WHERE x.order_id = o.id);

-- El contador de folios de tickets queda en el mayor consecutivo de 2026 (sin retroceder si ya hay más).
INSERT INTO ticket_folio_counters (year, last_number)
SELECT 2026, COUNT(*) FROM tickets WHERE folio LIKE 'TK-2026-%'
ON DUPLICATE KEY UPDATE last_number = GREATEST(last_number, VALUES(last_number));
