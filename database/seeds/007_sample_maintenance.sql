-- Mantenimientos programados de ejemplo (Sprint 3): Normal, Próximo y Vencido (por fecha y por kilometraje),
-- uno atendido y uno cancelado. Las fechas son relativas a la fecha de carga y los kilometrajes al actual de cada
-- vehículo, así que el estado esperado se mantiene al repetir el seed en otro día.
-- Idempotente: cada mantenimiento se identifica por vehículo y descripción. Requiere los seeds 003 y 005.

INSERT INTO maintenance
  (vehicle_id, order_id, description, due_date, due_mileage, notes, status, cancel_reason, closed_at, closed_by, created_by)
SELECT v.id, o.id, d.description, d.due_date,
       IF(d.km_delta IS NULL, NULL, GREATEST(v.current_mileage + d.km_delta, 1)),
       d.notes, d.status, d.cancel_reason, d.closed_at, IF(d.closed_at IS NULL, NULL, a.id), o.mechanic_id
FROM (
  SELECT 'AST3318' AS plate, 'OS-2026-0001' AS folio, 'Cambio de aceite y filtro' AS description, DATE(DATE_ADD(NOW(), INTERVAL 10 DAY)) AS due_date, 800 AS km_delta, 'Usar aceite sintético 5W-30' AS notes, 'PROGRAMADO' AS status, NULL AS cancel_reason, NULL AS closed_at
  UNION ALL SELECT 'TDE1001', 'OS-2026-0002', 'Revisión del embrague', DATE(DATE_ADD(NOW(), INTERVAL -12 DAY)), NULL, 'Verificar el volante del motor', 'PROGRAMADO', NULL, NULL
  UNION ALL SELECT 'TDE1002', 'OS-2026-0006', 'Cambio de banda de distribución', NULL, -300, NULL, 'PROGRAMADO', NULL, NULL
  UNION ALL SELECT 'RCA6620', 'OS-2026-0008', 'Rotación y balanceo de llantas', DATE(DATE_ADD(NOW(), INTERVAL 90 DAY)), 9000, NULL, 'PROGRAMADO', NULL, NULL
  UNION ALL SELECT 'HRN4521', 'OS-2026-0004', 'Revisión de suspensión', DATE(DATE_ADD(NOW(), INTERVAL 25 DAY)), NULL, 'Reportó ruido al pasar topes', 'PROGRAMADO', NULL, NULL
  UNION ALL SELECT 'MZD5103', 'OS-2026-0005', 'Cambio de filtro de combustible', NULL, 6000, NULL, 'PROGRAMADO', NULL, NULL
  UNION ALL SELECT 'AST3318', 'OS-2026-0001', 'Cambio de bujías', DATE(DATE_ADD(NOW(), INTERVAL -20 DAY)), NULL, NULL, 'ATENDIDO', NULL, DATE_SUB(NOW(), INTERVAL 72 HOUR)
  UNION ALL SELECT 'TDE1003', 'OS-2026-0007', 'Sustitución de manguera del radiador', DATE(DATE_ADD(NOW(), INTERVAL 40 DAY)), NULL, NULL, 'CANCELADO', 'El cliente lo pospuso', DATE_SUB(NOW(), INTERVAL 48 HOUR)
) AS d
JOIN vehicles v ON v.license_plate = d.plate
JOIN service_orders o ON o.folio = d.folio
JOIN users a ON a.username = 'admin'
WHERE NOT EXISTS (SELECT 1 FROM maintenance m WHERE m.vehicle_id = v.id AND m.description = d.description);
