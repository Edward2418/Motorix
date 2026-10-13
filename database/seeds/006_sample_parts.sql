-- Refacciones de ejemplo (Sprint 3): 13 piezas en niveles Normal, Bajo y Agotado y una desactivada.
-- Idempotente: cada refacción se identifica por su código; sus movimientos solo se insertan si todavía no tiene ninguno,
-- y cada línea de orden solo si la orden aún no usa esa refacción. El stock de cada pieza es la suma de sus movimientos.
-- Requiere los seeds 001 (usuarios) y 005 (órdenes). También completa el kilometraje del servicio de las órdenes
-- finalizadas de ejemplo.

INSERT INTO parts (code, name, category, brand, stock, min_stock, purchase_price, sale_price, active)
SELECT d.code, d.name, d.category, d.brand, d.stock, d.min_stock, d.purchase_price, d.sale_price, d.active
FROM (
  SELECT 'BUJ-NGK-01' AS code, 'Bujía de iridio' AS name, 'Motor' AS category, 'NGK' AS brand, 24 AS stock, 8 AS min_stock, 95.00 AS purchase_price, 150.00 AS sale_price, 1 AS active
  UNION ALL SELECT 'FIL-ACE-02', 'Filtro de aceite', 'Motor', 'Mann', 3, 10, 115.00, 180.00, 1
  UNION ALL SELECT 'FIL-AIR-03', 'Filtro de aire', 'Motor', 'Mann', 17, 6, 140.00, 220.00, 1
  UNION ALL SELECT 'ACE-5W30-11', 'Aceite sintético 5W-30 (1 L)', 'Lubricantes', 'Mobil', 44, 12, 75.00, 120.00, 1
  UNION ALL SELECT 'BAL-DEL-04', 'Balatas delanteras', 'Frenos', 'Brembo', 0, 4, 610.00, 950.00, 1
  UNION ALL SELECT 'DIS-FRE-05', 'Disco de freno ventilado', 'Frenos', 'Brembo', 6, 4, 820.00, 1250.00, 1
  UNION ALL SELECT 'AMO-DEL-06', 'Amortiguador delantero', 'Suspensión', 'Monroe', 5, 4, 980.00, 1480.00, 1
  UNION ALL SELECT 'EMB-KIT-07', 'Kit de embrague', 'Transmisión', 'Sachs', 2, 2, 2450.00, 3600.00, 1
  UNION ALL SELECT 'BOM-AGU-08', 'Bomba de agua', 'Enfriamiento', 'Gates', 4, 3, 720.00, 1150.00, 1
  UNION ALL SELECT 'ANT-5L-09', 'Anticongelante (5 L)', 'Enfriamiento', 'Prestone', 14, 6, 260.00, 420.00, 1
  UNION ALL SELECT 'RAD-ALU-10', 'Radiador de aluminio', 'Enfriamiento', 'Nissens', 0, 2, 1900.00, 2850.00, 1
  UNION ALL SELECT 'BAT-12V-12', 'Batería 12 V', 'Eléctrico', 'LTH', 7, 3, 1500.00, 2150.00, 1
  UNION ALL SELECT 'LAM-H4-13', 'Lámpara H4 (descontinuada)', 'Eléctrico', 'Philips', 5, 5, 50.00, 95.00, 0
) AS d
WHERE NOT EXISTS (SELECT 1 FROM parts p WHERE p.code = d.code);

-- Los movimientos de salida se atribuyen al mecánico de la orden; los demás, a la administración.
INSERT INTO inventory_movements (part_id, type, quantity, stock_after, reason, order_id, created_by, created_at)
SELECT p.id, d.type, d.quantity, d.stock_after, d.reason, o.id, COALESCE(m.id, a.id), d.created_at
FROM (
  SELECT 'BUJ-NGK-01' AS code, 'ENTRADA' AS type, 30 AS quantity, 30 AS stock_after, 'Stock inicial' AS reason, NULL AS folio, 'admin' AS username, DATE_SUB(NOW(), INTERVAL 720 HOUR) AS created_at
  UNION ALL SELECT 'BUJ-NGK-01', 'SALIDA', -4, 26, 'Uso en la orden OS-2026-0001', 'OS-2026-0001', 'ORDEN', DATE_SUB(NOW(), INTERVAL 216 HOUR)
  UNION ALL SELECT 'BUJ-NGK-01', 'AJUSTE', -2, 24, 'Conteo físico: piezas dañadas', NULL, 'admin', DATE_SUB(NOW(), INTERVAL 120 HOUR)
  UNION ALL SELECT 'FIL-ACE-02', 'ENTRADA', 12, 12, 'Stock inicial', NULL, 'admin', DATE_SUB(NOW(), INTERVAL 720 HOUR)
  UNION ALL SELECT 'FIL-ACE-02', 'SALIDA', -1, 11, 'Uso en la orden OS-2026-0001', 'OS-2026-0001', 'ORDEN', DATE_SUB(NOW(), INTERVAL 216 HOUR)
  UNION ALL SELECT 'FIL-ACE-02', 'AJUSTE', -8, 3, 'Conteo físico: faltante en almacén', NULL, 'admin', DATE_SUB(NOW(), INTERVAL 96 HOUR)
  UNION ALL SELECT 'FIL-AIR-03', 'ENTRADA', 20, 20, 'Stock inicial', NULL, 'admin', DATE_SUB(NOW(), INTERVAL 720 HOUR)
  UNION ALL SELECT 'FIL-AIR-03', 'AJUSTE', -2, 18, 'Conteo físico: piezas dañadas', NULL, 'admin', DATE_SUB(NOW(), INTERVAL 96 HOUR)
  UNION ALL SELECT 'FIL-AIR-03', 'SALIDA', -1, 17, 'Uso en la orden OS-2026-0008', 'OS-2026-0008', 'ORDEN', DATE_SUB(NOW(), INTERVAL 24 HOUR)
  UNION ALL SELECT 'ACE-5W30-11', 'ENTRADA', 48, 48, 'Stock inicial', NULL, 'admin', DATE_SUB(NOW(), INTERVAL 720 HOUR)
  UNION ALL SELECT 'ACE-5W30-11', 'SALIDA', -4, 44, 'Uso en la orden OS-2026-0001', 'OS-2026-0001', 'ORDEN', DATE_SUB(NOW(), INTERVAL 216 HOUR)
  UNION ALL SELECT 'BAL-DEL-04', 'ENTRADA', 8, 8, 'Stock inicial', NULL, 'admin', DATE_SUB(NOW(), INTERVAL 720 HOUR)
  UNION ALL SELECT 'BAL-DEL-04', 'AJUSTE', -8, 0, 'Ajuste por conteo físico: sin existencia', NULL, 'admin', DATE_SUB(NOW(), INTERVAL 72 HOUR)
  UNION ALL SELECT 'DIS-FRE-05', 'ENTRADA', 6, 6, 'Stock inicial', NULL, 'admin', DATE_SUB(NOW(), INTERVAL 720 HOUR)
  UNION ALL SELECT 'AMO-DEL-06', 'ENTRADA', 5, 5, 'Stock inicial', NULL, 'admin', DATE_SUB(NOW(), INTERVAL 720 HOUR)
  UNION ALL SELECT 'EMB-KIT-07', 'ENTRADA', 3, 3, 'Stock inicial', NULL, 'admin', DATE_SUB(NOW(), INTERVAL 720 HOUR)
  UNION ALL SELECT 'EMB-KIT-07', 'SALIDA', -1, 2, 'Uso en la orden OS-2026-0002', 'OS-2026-0002', 'ORDEN', DATE_SUB(NOW(), INTERVAL 144 HOUR)
  UNION ALL SELECT 'BOM-AGU-08', 'ENTRADA', 5, 5, 'Stock inicial', NULL, 'admin', DATE_SUB(NOW(), INTERVAL 720 HOUR)
  UNION ALL SELECT 'BOM-AGU-08', 'SALIDA', -1, 4, 'Uso en la orden OS-2026-0006', 'OS-2026-0006', 'ORDEN', DATE_SUB(NOW(), INTERVAL 12 HOUR)
  UNION ALL SELECT 'ANT-5L-09', 'ENTRADA', 16, 16, 'Stock inicial', NULL, 'admin', DATE_SUB(NOW(), INTERVAL 720 HOUR)
  UNION ALL SELECT 'ANT-5L-09', 'SALIDA', -2, 14, 'Uso en la orden OS-2026-0006', 'OS-2026-0006', 'ORDEN', DATE_SUB(NOW(), INTERVAL 12 HOUR)
  UNION ALL SELECT 'RAD-ALU-10', 'ENTRADA', 2, 2, 'Stock inicial', NULL, 'admin', DATE_SUB(NOW(), INTERVAL 720 HOUR)
  UNION ALL SELECT 'RAD-ALU-10', 'AJUSTE', -2, 0, 'Devuelto al proveedor por defecto de fábrica', NULL, 'admin', DATE_SUB(NOW(), INTERVAL 72 HOUR)
  UNION ALL SELECT 'BAT-12V-12', 'ENTRADA', 7, 7, 'Stock inicial', NULL, 'admin', DATE_SUB(NOW(), INTERVAL 720 HOUR)
  UNION ALL SELECT 'LAM-H4-13', 'ENTRADA', 5, 5, 'Stock inicial', NULL, 'admin', DATE_SUB(NOW(), INTERVAL 720 HOUR)
) AS d
JOIN parts p ON p.code = d.code
JOIN users a ON a.username = 'admin'
LEFT JOIN service_orders o ON o.folio = d.folio
LEFT JOIN users m ON m.id = o.mechanic_id
WHERE NOT EXISTS (SELECT 1 FROM inventory_movements mv WHERE mv.part_id = p.id);

INSERT INTO order_parts (order_id, part_id, quantity, unit_price, created_at)
SELECT o.id, p.id, d.quantity, p.sale_price, d.created_at
FROM (
  SELECT 'OS-2026-0001' AS folio, 'BUJ-NGK-01' AS code, 4 AS quantity, DATE_SUB(NOW(), INTERVAL 216 HOUR) AS created_at
  UNION ALL SELECT 'OS-2026-0001', 'FIL-ACE-02', 1, DATE_SUB(NOW(), INTERVAL 216 HOUR)
  UNION ALL SELECT 'OS-2026-0008', 'FIL-AIR-03', 1, DATE_SUB(NOW(), INTERVAL 24 HOUR)
  UNION ALL SELECT 'OS-2026-0001', 'ACE-5W30-11', 4, DATE_SUB(NOW(), INTERVAL 216 HOUR)
  UNION ALL SELECT 'OS-2026-0002', 'EMB-KIT-07', 1, DATE_SUB(NOW(), INTERVAL 144 HOUR)
  UNION ALL SELECT 'OS-2026-0006', 'BOM-AGU-08', 1, DATE_SUB(NOW(), INTERVAL 12 HOUR)
  UNION ALL SELECT 'OS-2026-0006', 'ANT-5L-09', 2, DATE_SUB(NOW(), INTERVAL 12 HOUR)
) AS d
JOIN service_orders o ON o.folio = d.folio
JOIN parts p ON p.code = d.code
WHERE NOT EXISTS (SELECT 1 FROM order_parts op WHERE op.order_id = o.id AND op.part_id = p.id);

-- Kilometraje del servicio de las órdenes finalizadas de ejemplo (mayor o igual al de entrada).
UPDATE service_orders SET service_mileage = entry_mileage + 50 WHERE folio = 'OS-2026-0001' AND (service_mileage IS NULL OR service_mileage = entry_mileage);
UPDATE service_orders SET service_mileage = entry_mileage + 100 WHERE folio = 'OS-2026-0002' AND (service_mileage IS NULL OR service_mileage = entry_mileage);
UPDATE service_orders SET service_mileage = entry_mileage + 100 WHERE folio = 'OS-2026-0008' AND (service_mileage IS NULL OR service_mileage = entry_mileage);

-- El kilometraje actual de cada vehículo nunca baja del kilometraje del servicio de sus órdenes.
UPDATE vehicles v
JOIN service_orders o ON o.vehicle_id = v.id
SET v.current_mileage = GREATEST(v.current_mileage, o.service_mileage)
WHERE o.service_mileage IS NOT NULL;
