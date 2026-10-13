-- Clientes de ejemplo para que la aplicación muestre información al arrancar.
-- Idempotente: cada cliente se inserta solo si no existe uno con el mismo nombre y teléfono.
-- Incluye un cliente desactivado ("Refaccionaria El Tornillo") y uno sin vehículos ("Laura Mendoza").

INSERT INTO clients (name, phone, email, active)
SELECT d.name, d.phone, d.email, d.active
FROM (
  SELECT 'Carlos Hernández' AS name, '55 1234 5601' AS phone, 'carlos.hernandez@ejemplo.com' AS email, 1 AS active
  UNION ALL SELECT 'María Fernanda López', '55 1234 5602', 'mafer.lopez@ejemplo.com', 1
  UNION ALL SELECT 'José Luis Ramírez', '55 1234 5603', NULL, 1
  UNION ALL SELECT 'Ana Sofía Torres', '55 1234 5604', 'ana.torres@ejemplo.com', 1
  UNION ALL SELECT 'Transportes Delgado', '55 1234 5605', 'contacto@transportesdelgado.example', 1
  UNION ALL SELECT 'Roberto Castillo', '55 1234 5606', 'roberto.castillo@ejemplo.com', 1
  UNION ALL SELECT 'Laura Mendoza', '55 1234 5607', 'laura.mendoza@ejemplo.com', 1
  UNION ALL SELECT 'Refaccionaria El Tornillo', '55 1234 5608', NULL, 0
) AS d
WHERE NOT EXISTS (
  SELECT 1 FROM clients c WHERE c.name = d.name AND c.phone = d.phone
);
