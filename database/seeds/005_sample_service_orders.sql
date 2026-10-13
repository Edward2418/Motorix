-- Órdenes de servicio de ejemplo (Sprint 2): una por cada estado, repartidas entre dos mecánicos.
-- Idempotente: cada orden se identifica por su folio y cada servicio, línea o historial se inserta una sola vez.
-- Requiere los seeds 001 (usuarios), 003 (vehículos) y 004 (citas). Los folios se reservan en folio_counters.
-- Este archivo crea al mecánico "mecanico2" con el hash bcrypt de su contraseña del estándar del MVP
-- (docs/project-context.md); nunca contiene la contraseña en texto plano.

INSERT INTO users (username, name, email, password_hash, role, active)
SELECT 'mecanico2', 'Mecánico Dos Motorix', 'mecanico2@motorix.local', '$2b$10$4MTQUxwCf3MPuInvNj6Ec.rlC/hHydmw179sHQlmER8pdG2G/sNS.', 'MECHANIC', 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'mecanico2' OR email = 'mecanico2@motorix.local');

INSERT INTO service_orders
  (folio, client_id, vehicle_id, mechanic_id, appointment_id, entry_mileage, previous_mileage, reported_problem,
   diagnosis, notes, recommendations, status, cancel_reason, delivered_at, created_by, created_at)
SELECT d.folio, v.client_id, v.id, m.id, a.id, d.entry_mileage, d.previous_mileage, d.reported_problem,
       d.diagnosis, d.notes, d.recommendations, d.status, d.cancel_reason, d.delivered_at, r.id, d.created_at
FROM (
  SELECT 'OS-2026-0001' AS folio, 'AST3318' AS plate, 'mecanico' AS mechanic, 'Afinación mayor (ejemplo)' AS appointment_reason, 41950 AS entry_mileage, 41000 AS previous_mileage, 'Pérdida de potencia y consumo alto de gasolina' AS reported_problem, 'Bujías desgastadas y filtro de aire saturado' AS diagnosis, 'Se revisaron niveles y presión de llantas' AS notes, 'Repetir la afinación a los 40,000 km' AS recommendations, 'ENTREGADO' AS status, NULL AS cancel_reason, DATE_SUB(DATE_SUB(NOW(), INTERVAL 10 DAY), INTERVAL 2 HOUR) AS created_at, DATE_SUB(DATE_SUB(NOW(), INTERVAL 9 DAY), INTERVAL 1 HOUR) AS delivered_at
  UNION ALL SELECT 'OS-2026-0002', 'TDE1001', 'mecanico2', NULL, 203100, 202800, 'El embrague patina al subir pendientes', 'Disco de embrague desgastado', NULL, 'Revisar el volante del motor en el próximo servicio', 'ENTREGADO', NULL, DATE_SUB(DATE_SUB(NOW(), INTERVAL 7 DAY), INTERVAL 3 HOUR), DATE_SUB(DATE_SUB(NOW(), INTERVAL 5 DAY), INTERVAL 2 HOUR)
  UNION ALL SELECT 'OS-2026-0003', 'JLR7745', 'mecanico2', NULL, 155800, 155000, 'Ruido metálico en la suspensión delantera', 'Amortiguadores delanteros vencidos', NULL, NULL, 'CANCELADA', 'El cliente rechazó el presupuesto', DATE_SUB(DATE_SUB(NOW(), INTERVAL 6 DAY), INTERVAL 4 HOUR), NULL
  UNION ALL SELECT 'OS-2026-0004', 'HRN4521', 'mecanico', 'Diagnóstico de ruido en suspensión (ejemplo)', 68300, 68250, 'Ruido al pasar topes y vibración en el volante', NULL, NULL, NULL, 'DIAGNOSTICO', NULL, DATE_SUB(DATE_SUB(NOW(), INTERVAL 2 DAY), INTERVAL 1 HOUR), NULL
  UNION ALL SELECT 'OS-2026-0005', 'MZD5103', 'mecanico2', NULL, 85000, 84900, 'Se enciende el testigo de la batería', NULL, NULL, NULL, 'RECIBIDO', NULL, DATE_SUB(DATE_SUB(NOW(), INTERVAL 0 DAY), INTERVAL 3 HOUR), NULL
  UNION ALL SELECT 'OS-2026-0006', 'TDE1002', 'mecanico2', NULL, 178400, 178300, 'Sobrecalentamiento del motor en carretera', 'Bomba de agua con fuga', 'Se cambió también el anticongelante', NULL, 'EN_REPARACION', NULL, DATE_SUB(DATE_SUB(NOW(), INTERVAL 1 DAY), INTERVAL 5 HOUR), NULL
  UNION ALL SELECT 'OS-2026-0007', 'TDE1003', 'mecanico', NULL, 242000, 241900, 'Fuga de líquido anticongelante', 'Radiador con fisura en el depósito', 'Se espera la refacción del proveedor', NULL, 'ESPERANDO_REFACCION', NULL, DATE_SUB(DATE_SUB(NOW(), INTERVAL 3 DAY), INTERVAL 2 HOUR), NULL
  UNION ALL SELECT 'OS-2026-0008', 'RCA6620', 'mecanico', NULL, 22500, 22400, 'Desgaste irregular en las llantas', 'Desalineación del tren delantero', NULL, 'Rotar llantas cada 10,000 km', 'TERMINADO', NULL, DATE_SUB(DATE_SUB(NOW(), INTERVAL 1 DAY), INTERVAL 8 HOUR), NULL
) AS d
JOIN vehicles v ON v.license_plate = d.plate
JOIN users m ON m.username = d.mechanic
JOIN users r ON r.username = 'recepcion'
LEFT JOIN appointments a ON a.vehicle_id = v.id AND a.reason = d.appointment_reason
WHERE NOT EXISTS (SELECT 1 FROM service_orders o WHERE o.folio = d.folio);

INSERT INTO order_services (order_id, description, cost)
SELECT o.id, d.description, d.amount
FROM (
  SELECT 'OS-2026-0001' AS folio, 'Afinación mayor' AS description, 1850.00 AS amount
  UNION ALL SELECT 'OS-2026-0001', 'Cambio de bujías', 960.00
  UNION ALL SELECT 'OS-2026-0002', 'Cambio de kit de embrague', 4200.00
  UNION ALL SELECT 'OS-2026-0003', 'Diagnóstico de suspensión', 350.00
  UNION ALL SELECT 'OS-2026-0006', 'Cambio de bomba de agua', 2350.00
  UNION ALL SELECT 'OS-2026-0007', 'Desmontaje de radiador', 500.00
  UNION ALL SELECT 'OS-2026-0008', 'Alineación y balanceo', 650.00
) AS d
JOIN service_orders o ON o.folio = d.folio
WHERE NOT EXISTS (SELECT 1 FROM order_services t WHERE t.order_id = o.id AND t.description = d.description);

INSERT INTO order_labor (order_id, description, amount)
SELECT o.id, d.description, d.amount
FROM (
  SELECT 'OS-2026-0001' AS folio, 'Mano de obra de afinación' AS description, 700.00 AS amount
  UNION ALL SELECT 'OS-2026-0002', 'Mano de obra de embrague', 1800.00
  UNION ALL SELECT 'OS-2026-0006', 'Mano de obra de bomba de agua', 900.00
) AS d
JOIN service_orders o ON o.folio = d.folio
WHERE NOT EXISTS (SELECT 1 FROM order_labor t WHERE t.order_id = o.id AND t.description = d.description);

INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, reason, changed_at)
SELECT o.id, d.from_status, d.to_status, u.id, d.reason, d.changed_at
FROM (
  SELECT 'OS-2026-0001' AS folio, NULL AS from_status, 'RECIBIDO' AS to_status, 'recepcion' AS changed_by, NULL AS reason, DATE_ADD(DATE_SUB(DATE_SUB(NOW(), INTERVAL 10 DAY), INTERVAL 2 HOUR), INTERVAL 0 HOUR) AS changed_at
  UNION ALL SELECT 'OS-2026-0001', 'RECIBIDO', 'DIAGNOSTICO', 'mecanico', NULL, DATE_ADD(DATE_SUB(DATE_SUB(NOW(), INTERVAL 10 DAY), INTERVAL 2 HOUR), INTERVAL 3 HOUR)
  UNION ALL SELECT 'OS-2026-0001', 'DIAGNOSTICO', 'EN_REPARACION', 'mecanico', NULL, DATE_ADD(DATE_SUB(DATE_SUB(NOW(), INTERVAL 10 DAY), INTERVAL 2 HOUR), INTERVAL 6 HOUR)
  UNION ALL SELECT 'OS-2026-0001', 'EN_REPARACION', 'TERMINADO', 'mecanico', NULL, DATE_ADD(DATE_SUB(DATE_SUB(NOW(), INTERVAL 10 DAY), INTERVAL 2 HOUR), INTERVAL 9 HOUR)
  UNION ALL SELECT 'OS-2026-0001', 'TERMINADO', 'ENTREGADO', 'recepcion', NULL, DATE_ADD(DATE_SUB(DATE_SUB(NOW(), INTERVAL 10 DAY), INTERVAL 2 HOUR), INTERVAL 12 HOUR)
  UNION ALL SELECT 'OS-2026-0002', NULL, 'RECIBIDO', 'recepcion', NULL, DATE_ADD(DATE_SUB(DATE_SUB(NOW(), INTERVAL 7 DAY), INTERVAL 3 HOUR), INTERVAL 0 HOUR)
  UNION ALL SELECT 'OS-2026-0002', 'RECIBIDO', 'DIAGNOSTICO', 'mecanico2', NULL, DATE_ADD(DATE_SUB(DATE_SUB(NOW(), INTERVAL 7 DAY), INTERVAL 3 HOUR), INTERVAL 3 HOUR)
  UNION ALL SELECT 'OS-2026-0002', 'DIAGNOSTICO', 'EN_REPARACION', 'mecanico2', NULL, DATE_ADD(DATE_SUB(DATE_SUB(NOW(), INTERVAL 7 DAY), INTERVAL 3 HOUR), INTERVAL 6 HOUR)
  UNION ALL SELECT 'OS-2026-0002', 'EN_REPARACION', 'TERMINADO', 'mecanico2', NULL, DATE_ADD(DATE_SUB(DATE_SUB(NOW(), INTERVAL 7 DAY), INTERVAL 3 HOUR), INTERVAL 9 HOUR)
  UNION ALL SELECT 'OS-2026-0002', 'TERMINADO', 'ENTREGADO', 'recepcion', NULL, DATE_ADD(DATE_SUB(DATE_SUB(NOW(), INTERVAL 7 DAY), INTERVAL 3 HOUR), INTERVAL 12 HOUR)
  UNION ALL SELECT 'OS-2026-0003', NULL, 'RECIBIDO', 'recepcion', NULL, DATE_ADD(DATE_SUB(DATE_SUB(NOW(), INTERVAL 6 DAY), INTERVAL 4 HOUR), INTERVAL 0 HOUR)
  UNION ALL SELECT 'OS-2026-0003', 'RECIBIDO', 'DIAGNOSTICO', 'mecanico2', NULL, DATE_ADD(DATE_SUB(DATE_SUB(NOW(), INTERVAL 6 DAY), INTERVAL 4 HOUR), INTERVAL 3 HOUR)
  UNION ALL SELECT 'OS-2026-0003', 'DIAGNOSTICO', 'CANCELADA', 'recepcion', 'El cliente rechazó el presupuesto', DATE_ADD(DATE_SUB(DATE_SUB(NOW(), INTERVAL 6 DAY), INTERVAL 4 HOUR), INTERVAL 6 HOUR)
  UNION ALL SELECT 'OS-2026-0004', NULL, 'RECIBIDO', 'recepcion', NULL, DATE_ADD(DATE_SUB(DATE_SUB(NOW(), INTERVAL 2 DAY), INTERVAL 1 HOUR), INTERVAL 0 HOUR)
  UNION ALL SELECT 'OS-2026-0004', 'RECIBIDO', 'DIAGNOSTICO', 'mecanico', NULL, DATE_ADD(DATE_SUB(DATE_SUB(NOW(), INTERVAL 2 DAY), INTERVAL 1 HOUR), INTERVAL 3 HOUR)
  UNION ALL SELECT 'OS-2026-0005', NULL, 'RECIBIDO', 'recepcion', NULL, DATE_ADD(DATE_SUB(DATE_SUB(NOW(), INTERVAL 0 DAY), INTERVAL 3 HOUR), INTERVAL 0 HOUR)
  UNION ALL SELECT 'OS-2026-0006', NULL, 'RECIBIDO', 'recepcion', NULL, DATE_ADD(DATE_SUB(DATE_SUB(NOW(), INTERVAL 1 DAY), INTERVAL 5 HOUR), INTERVAL 0 HOUR)
  UNION ALL SELECT 'OS-2026-0006', 'RECIBIDO', 'DIAGNOSTICO', 'mecanico2', NULL, DATE_ADD(DATE_SUB(DATE_SUB(NOW(), INTERVAL 1 DAY), INTERVAL 5 HOUR), INTERVAL 3 HOUR)
  UNION ALL SELECT 'OS-2026-0006', 'DIAGNOSTICO', 'EN_REPARACION', 'mecanico2', NULL, DATE_ADD(DATE_SUB(DATE_SUB(NOW(), INTERVAL 1 DAY), INTERVAL 5 HOUR), INTERVAL 6 HOUR)
  UNION ALL SELECT 'OS-2026-0007', NULL, 'RECIBIDO', 'recepcion', NULL, DATE_ADD(DATE_SUB(DATE_SUB(NOW(), INTERVAL 3 DAY), INTERVAL 2 HOUR), INTERVAL 0 HOUR)
  UNION ALL SELECT 'OS-2026-0007', 'RECIBIDO', 'DIAGNOSTICO', 'mecanico', NULL, DATE_ADD(DATE_SUB(DATE_SUB(NOW(), INTERVAL 3 DAY), INTERVAL 2 HOUR), INTERVAL 3 HOUR)
  UNION ALL SELECT 'OS-2026-0007', 'DIAGNOSTICO', 'EN_REPARACION', 'mecanico', NULL, DATE_ADD(DATE_SUB(DATE_SUB(NOW(), INTERVAL 3 DAY), INTERVAL 2 HOUR), INTERVAL 6 HOUR)
  UNION ALL SELECT 'OS-2026-0007', 'EN_REPARACION', 'ESPERANDO_REFACCION', 'mecanico', NULL, DATE_ADD(DATE_SUB(DATE_SUB(NOW(), INTERVAL 3 DAY), INTERVAL 2 HOUR), INTERVAL 9 HOUR)
  UNION ALL SELECT 'OS-2026-0008', NULL, 'RECIBIDO', 'recepcion', NULL, DATE_ADD(DATE_SUB(DATE_SUB(NOW(), INTERVAL 1 DAY), INTERVAL 8 HOUR), INTERVAL 0 HOUR)
  UNION ALL SELECT 'OS-2026-0008', 'RECIBIDO', 'DIAGNOSTICO', 'mecanico', NULL, DATE_ADD(DATE_SUB(DATE_SUB(NOW(), INTERVAL 1 DAY), INTERVAL 8 HOUR), INTERVAL 3 HOUR)
  UNION ALL SELECT 'OS-2026-0008', 'DIAGNOSTICO', 'EN_REPARACION', 'mecanico', NULL, DATE_ADD(DATE_SUB(DATE_SUB(NOW(), INTERVAL 1 DAY), INTERVAL 8 HOUR), INTERVAL 6 HOUR)
  UNION ALL SELECT 'OS-2026-0008', 'EN_REPARACION', 'TERMINADO', 'mecanico', NULL, DATE_ADD(DATE_SUB(DATE_SUB(NOW(), INTERVAL 1 DAY), INTERVAL 8 HOUR), INTERVAL 9 HOUR)
) AS d
JOIN service_orders o ON o.folio = d.folio
JOIN users u ON u.username = d.changed_by
WHERE NOT EXISTS (SELECT 1 FROM order_status_history h WHERE h.order_id = o.id);

-- El kilometraje actual de cada vehículo nunca baja del de entrada de su orden más reciente.
UPDATE vehicles v
JOIN service_orders o ON o.vehicle_id = v.id
SET v.current_mileage = GREATEST(v.current_mileage, o.entry_mileage)
WHERE o.folio LIKE 'OS-2026-%';

-- Reserva los folios usados para que las órdenes nuevas continúen la numeración.
INSERT INTO folio_counters (year, last_number) VALUES (2026, 8)
ON DUPLICATE KEY UPDATE last_number = GREATEST(last_number, 8);
