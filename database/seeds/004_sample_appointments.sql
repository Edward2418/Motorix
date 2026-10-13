-- Citas de ejemplo para que la aplicación muestre información al arrancar (Sprint 2).
-- Las fechas son relativas al día en que se carga el seed. Idempotente: cada cita se inserta solo si el
-- vehículo no tiene ya una con el mismo motivo (todos los motivos llevan el marcador "(ejemplo)").
-- Las citas EN_PROCESO y COMPLETADA se vinculan a sus órdenes en el seed 005.
-- Requiere los usuarios del seed 001 y los vehículos del seed 003.

INSERT INTO appointments (client_id, vehicle_id, scheduled_at, reason, notes, status, cancel_reason, created_by)
SELECT v.client_id, v.id, d.scheduled_at, d.reason, d.notes, d.status, d.cancel_reason, u.id
FROM (
  SELECT 'JTT8830' AS plate,
         DATE_ADD(DATE_ADD(CURDATE(), INTERVAL 3 DAY), INTERVAL '10:00:00' HOUR_SECOND) AS scheduled_at,
         'Servicio de 100,000 km (ejemplo)' AS reason,
         'Traer el manual del propietario' AS notes,
         'PENDIENTE' AS status,
         NULL AS cancel_reason
  UNION ALL
  SELECT 'MFL2210',
         DATE_ADD(DATE_ADD(CURDATE(), INTERVAL 1 DAY), INTERVAL '09:30:00' HOUR_SECOND),
         'Cambio de aceite y filtros (ejemplo)',
         NULL,
         'CONFIRMADA',
         NULL
  UNION ALL
  SELECT 'AST9067',
         DATE_ADD(CURDATE(), INTERVAL '17:00:00' HOUR_SECOND),
         'Revisión de frenos (ejemplo)',
         'El cliente reporta ruido al frenar',
         'PENDIENTE',
         NULL
  UNION ALL
  SELECT 'HRN4521',
         DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 2 DAY), INTERVAL '11:00:00' HOUR_SECOND),
         'Diagnóstico de ruido en suspensión (ejemplo)',
         NULL,
         'EN_PROCESO',
         NULL
  UNION ALL
  SELECT 'AST3318',
         DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 10 DAY), INTERVAL '08:30:00' HOUR_SECOND),
         'Afinación mayor (ejemplo)',
         NULL,
         'COMPLETADA',
         NULL
  UNION ALL
  SELECT 'RCA6620',
         DATE_ADD(DATE_SUB(CURDATE(), INTERVAL 5 DAY), INTERVAL '12:00:00' HOUR_SECOND),
         'Alineación y balanceo (ejemplo)',
         NULL,
         'CANCELADA',
         'El cliente reprogramó para otra fecha'
) AS d
JOIN vehicles v ON v.license_plate = d.plate
JOIN users u ON u.username = 'recepcion'
WHERE NOT EXISTS (
  SELECT 1 FROM appointments a WHERE a.vehicle_id = v.id AND a.reason = d.reason
);
