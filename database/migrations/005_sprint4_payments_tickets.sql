-- Sprint 4: pagos de las órdenes, tickets de servicio y su contador de folios. Motor InnoDB, codificación utf8mb4.
-- No editar este script una vez aplicado. Nunca se guardan datos de tarjeta ni credenciales (RN-14).

CREATE TABLE payments (
  id                     INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  order_id               INT UNSIGNED  NOT NULL,
  amount                 DECIMAL(10,2) NOT NULL,
  method                 ENUM('EFECTIVO','TARJETA','TRANSFERENCIA','MERCADO_PAGO') NOT NULL,
  status                 ENUM('PENDIENTE','PAGADO','RECHAZADO','CANCELADO') NOT NULL DEFAULT 'PENDIENTE',
  reference              VARCHAR(100)  NULL,
  external_reference     VARCHAR(60)   NULL,
  external_preference_id VARCHAR(80)   NULL,
  external_payment_id    VARCHAR(40)   NULL,
  payment_link           VARCHAR(500)  NULL,
  expires_at             DATETIME      NULL,
  paid_at                DATETIME      NULL,
  cancel_reason          VARCHAR(255)  NULL,
  cancelled_by           INT UNSIGNED  NULL,
  cancelled_at           DATETIME      NULL,
  created_by             INT UNSIGNED  NOT NULL,
  created_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payments_external_reference (external_reference),
  KEY idx_payments_order (order_id, status),
  KEY idx_payments_status_paid (status, paid_at),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES service_orders (id) ON DELETE RESTRICT,
  CONSTRAINT fk_payments_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_payments_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT chk_payments_amount CHECK (amount > 0),
  CONSTRAINT chk_payments_cancel_reason CHECK (status <> 'CANCELADO' OR cancel_reason IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Un solo ticket por orden. No guarda copia del contenido: `order_total` solo sirve para avisar si la orden cambió
-- después de generar el ticket.
CREATE TABLE tickets (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  folio        VARCHAR(20)   NOT NULL,
  order_id     INT UNSIGNED  NOT NULL,
  order_total  DECIMAL(10,2) NOT NULL,
  generated_by INT UNSIGNED  NOT NULL,
  generated_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tickets_folio (folio),
  UNIQUE KEY uq_tickets_order (order_id),
  CONSTRAINT fk_tickets_order FOREIGN KEY (order_id) REFERENCES service_orders (id) ON DELETE RESTRICT,
  CONSTRAINT fk_tickets_generated_by FOREIGN KEY (generated_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE ticket_folio_counters (
  year        SMALLINT UNSIGNED NOT NULL,
  last_number INT UNSIGNED      NOT NULL DEFAULT 0,
  PRIMARY KEY (year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
