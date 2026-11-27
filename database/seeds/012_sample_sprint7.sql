-- Datos de ejemplo del Sprint 7 (reportes, configuración, términos y bitácora): lo mínimo para ver las funciones nuevas al
-- arrancar con los datos de ejemplo.
--   Configuración inicial guardada (los mismos valores que ya trae el servidor, para que nada cambie al cargar el seed).
--   Tipos de servicio con sus intervalos y, en las líneas de servicio que ya existían sin tipo, el tipo que corresponde.
--   Términos y condiciones, versión 1 (una plantilla). No se registra ninguna aceptación: cada cuenta de ejemplo ve los
--   términos vigentes en su primer inicio de sesión (la versión 2 llega con el seed 013).
--   Unos registros de bitácora de ejemplo, con fechas relativas.
-- Idempotente: cada fila se identifica por su clave, nombre, versión o detalle y solo se inserta si todavía no existe. Las
-- líneas de servicio que ya tienen tipo no se tocan. Ningún texto lleva punto y coma, porque el ejecutor de seeds corta en
-- cada uno. Requiere los seeds 001 (usuarios), 005 y 010 (órdenes y servicios) y 008 (pagos).

INSERT INTO settings (setting_key, setting_value, updated_by)
SELECT d.setting_key, d.setting_value, u.id
FROM (
  SELECT 'workshop_name' AS setting_key, 'Taller Motorix (ejemplo)' AS setting_value
  UNION ALL SELECT 'workshop_address', 'Av. Principal 123, Ciudad de México'
  UNION ALL SELECT 'workshop_phone', '55 0000 0000'
  UNION ALL SELECT 'maintenance_soon_days', '30'
  UNION ALL SELECT 'maintenance_soon_km', '1000'
) AS d
JOIN users u ON u.username = 'admin'
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.setting_key = d.setting_key);

INSERT INTO service_types (name, interval_days, interval_km)
SELECT d.name, d.interval_days, d.interval_km
FROM (
  SELECT 'Cambio de aceite' AS name, 180 AS interval_days, 5000 AS interval_km
  UNION ALL SELECT 'Afinación mayor', 365, 20000
  UNION ALL SELECT 'Alineación y balanceo', 180, 10000
  UNION ALL SELECT 'Cambio de bujías', 730, 40000
  UNION ALL SELECT 'Revisión de frenos', 365, 15000
  UNION ALL SELECT 'Cambio de batería', 1095, NULL
  UNION ALL SELECT 'Cambio de bomba de agua', NULL, 80000
) AS d
WHERE NOT EXISTS (SELECT 1 FROM service_types t WHERE t.name = d.name);

-- Liga con su tipo las líneas de servicio que ya existían y todavía no tienen uno (solo por coincidencia de descripción).
UPDATE order_services s
JOIN (
  SELECT 'Cambio de aceite y filtros' AS description, 'Cambio de aceite' AS type_name
  UNION ALL SELECT 'Afinación mayor', 'Afinación mayor'
  UNION ALL SELECT 'Alineación y balanceo', 'Alineación y balanceo'
  UNION ALL SELECT 'Cambio de bujías', 'Cambio de bujías'
  UNION ALL SELECT 'Instalación de batería', 'Cambio de batería'
  UNION ALL SELECT 'Cambio de bomba de agua', 'Cambio de bomba de agua'
) AS m ON m.description = s.description
JOIN service_types t ON t.name = m.type_name
SET s.service_type_id = t.id
WHERE s.service_type_id IS NULL;

INSERT INTO terms_versions (version, terms_text, privacy_text)
SELECT 1,
       'Términos y condiciones del servicio. Al usar Motorix aceptas que la información que registras, como clientes, vehículos, órdenes de servicio y pagos, se utilice solo para administrar el taller. Eres responsable de la confidencialidad de tu usuario y de tu contraseña, y de las acciones que se hagan con ellos. El taller puede revisar la bitácora de acciones sensibles para proteger la información. Estos términos son una plantilla de ejemplo del proyecto académico y deben revisarse antes de un uso real.',
       'Aviso de privacidad. Motorix guarda los datos de las personas que usan el sistema, como nombre, correo y rol, y los datos de los clientes y sus vehículos que el taller registra. No guarda números de tarjeta ni contraseñas en texto plano. Los datos se usan para operar el taller y no se comparten con terceros. Para corregir o eliminar tus datos habla con la administración del taller. Este aviso es una plantilla de ejemplo del proyecto académico.'
WHERE NOT EXISTS (SELECT 1 FROM terms_versions v WHERE v.version = 1);

-- Registros de bitácora de ejemplo: un inicio fallido, el alta de un mecánico, un cambio de configuración, un cambio de
-- precio de una refacción y un pago cancelado (si el seed 008 dejó uno).
INSERT INTO audit_log (user_id, actor, action, entity, entity_id, detail, created_at)
SELECT d.user_id, d.actor, d.action, d.entity, d.entity_id, d.detail, d.created_at
FROM (
  SELECT (SELECT id FROM users WHERE username = 'recepcion') AS user_id, 'recepcion' AS actor, 'LOGIN_FAILED' AS action,
         'USER' AS entity, (SELECT id FROM users WHERE username = 'recepcion') AS entity_id,
         NULL AS detail, DATE_SUB(NOW(), INTERVAL 30 HOUR) AS created_at
  UNION ALL SELECT (SELECT id FROM users WHERE username = 'admin'), 'admin', 'USER_CREATED', 'USER',
         (SELECT id FROM users WHERE username = 'mecanico2'), 'rol: MECHANIC', DATE_SUB(NOW(), INTERVAL 28 HOUR)
  UNION ALL SELECT (SELECT id FROM users WHERE username = 'admin'), 'admin', 'SETTINGS_CHANGED', 'SETTING', NULL,
         'teléfono del taller: modificado', DATE_SUB(NOW(), INTERVAL 20 HOUR)
  UNION ALL SELECT (SELECT id FROM users WHERE username = 'admin'), 'admin', 'PART_PRICE_CHANGED', 'PART',
         (SELECT id FROM parts WHERE code = 'FIL-ACE-02'), 'precio de venta: 170.00 → 180.00', DATE_SUB(NOW(), INTERVAL 10 HOUR)
  UNION ALL SELECT (SELECT id FROM users WHERE username = 'admin'), 'admin', 'PAYMENT_CANCELLED', 'PAYMENT',
         (SELECT id FROM payments WHERE status = 'CANCELADO' ORDER BY id LIMIT 1), 'estado anterior: PENDIENTE', DATE_SUB(NOW(), INTERVAL 3 HOUR)
) AS d
WHERE d.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM audit_log a WHERE a.action = d.action AND a.entity <=> d.entity AND a.detail <=> d.detail);
