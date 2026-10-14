-- Pagos de ejemplo (Sprint 4): los cuatro métodos y los cuatro estados sobre las órdenes terminadas y entregadas.
-- Los importes de los pagos vigentes (PAGADO y PENDIENTE) nunca superan el total de cada orden. Las fechas de cobro son
-- relativas a la fecha de carga para que el panel muestre cobros de hoy y de los últimos días.
-- Los pagos de Mercado Pago son datos ficticios: no existen en ninguna cuenta real y su enlace no funciona.
-- Idempotente: cada pago se identifica por orden y referencia de ejemplo. Requiere los seeds 001 y 005.

INSERT INTO payments
  (order_id, amount, method, status, reference, external_reference, external_payment_id, payment_link,
   expires_at, paid_at, cancel_reason, cancelled_by, cancelled_at, created_by)
SELECT o.id, p.amount, p.method, p.status, p.reference, p.external_reference, p.external_payment_id, p.payment_link,
       p.expires_at, p.paid_at, p.cancel_reason, IF(p.status = 'CANCELADO', a.id, NULL),
       IF(p.status = 'CANCELADO', DATE_SUB(NOW(), INTERVAL 3 HOUR), NULL), a.id
FROM (
  SELECT 'OS-2026-0001' AS folio, 2000.00 AS amount, 'EFECTIVO' AS method, 'PAGADO' AS status, 'Ejemplo 1' AS reference, NULL AS external_reference, NULL AS external_payment_id, NULL AS payment_link, NULL AS expires_at, DATE_SUB(NOW(), INTERVAL 9 DAY) AS paid_at, NULL AS cancel_reason
  UNION ALL SELECT 'OS-2026-0001', 1510.00, 'TRANSFERENCIA', 'PAGADO', 'Ejemplo 2', NULL, NULL, NULL, NULL, DATE_SUB(NOW(), INTERVAL 2 DAY), NULL
  UNION ALL SELECT 'OS-2026-0002', 3000.00, 'TARJETA', 'PAGADO', 'Ejemplo 3', NULL, NULL, NULL, NULL, DATE_SUB(NOW(), INTERVAL 5 DAY), NULL
  UNION ALL SELECT 'OS-2026-0002', 3000.00, 'MERCADO_PAGO', 'PAGADO', 'Ejemplo 4', 'mtx-ejemplo-0004', '1000000004', NULL, DATE_ADD(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 HOUR), NULL
  UNION ALL SELECT 'OS-2026-0008', 300.00, 'EFECTIVO', 'PAGADO', 'Ejemplo 5', NULL, NULL, NULL, NULL, DATE_SUB(NOW(), INTERVAL 30 MINUTE), NULL
  UNION ALL SELECT 'OS-2026-0008', 200.00, 'MERCADO_PAGO', 'PENDIENTE', 'Ejemplo 6', 'mtx-ejemplo-0006', NULL, 'https://sandbox.mercadopago.test/checkout/ejemplo-6', DATE_ADD(NOW(), INTERVAL 20 HOUR), NULL, NULL
  UNION ALL SELECT 'OS-2026-0008', 100.00, 'MERCADO_PAGO', 'RECHAZADO', 'Ejemplo 7', 'mtx-ejemplo-0007', NULL, NULL, DATE_SUB(NOW(), INTERVAL 1 DAY), NULL, NULL
  UNION ALL SELECT 'OS-2026-0008', 50.00, 'EFECTIVO', 'CANCELADO', 'Ejemplo 8', NULL, NULL, NULL, NULL, NULL, 'Capturado por error (ejemplo)'
) AS p
JOIN service_orders o ON o.folio = p.folio
JOIN users a ON a.username = 'admin'
WHERE NOT EXISTS (SELECT 1 FROM payments x WHERE x.order_id = o.id AND x.reference = p.reference);
