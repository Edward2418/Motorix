-- Sprint 2: citas, órdenes de servicio, servicios, mano de obra, historial de estados y folios.
-- Motor InnoDB, codificación utf8mb4. No editar este script una vez aplicado.

CREATE TABLE appointments (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id     INT UNSIGNED NOT NULL,
  vehicle_id    INT UNSIGNED NOT NULL,
  scheduled_at  DATETIME     NOT NULL,
  reason        VARCHAR(255) NOT NULL,
  notes         VARCHAR(1000) NULL,
  status        ENUM('PENDIENTE','CONFIRMADA','EN_PROCESO','COMPLETADA','CANCELADA') NOT NULL DEFAULT 'PENDIENTE',
  cancel_reason VARCHAR(255) NULL,
  created_by    INT UNSIGNED NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_appointments_scheduled_at (scheduled_at),
  KEY idx_appointments_vehicle (vehicle_id),
  KEY idx_appointments_status (status),
  KEY idx_appointments_client (client_id),
  CONSTRAINT fk_appointments_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE RESTRICT,
  CONSTRAINT fk_appointments_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles (id) ON DELETE RESTRICT,
  CONSTRAINT fk_appointments_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE service_orders (
  id                        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  folio                     VARCHAR(20)  NOT NULL,
  client_id                 INT UNSIGNED NOT NULL,
  vehicle_id                INT UNSIGNED NOT NULL,
  mechanic_id               INT UNSIGNED NOT NULL,
  appointment_id            INT UNSIGNED NULL,
  entry_mileage             INT UNSIGNED NOT NULL,
  previous_mileage          INT UNSIGNED NOT NULL,
  mileage_correction_reason VARCHAR(255) NULL,
  reported_problem          VARCHAR(2000) NOT NULL,
  diagnosis                 VARCHAR(4000) NULL,
  notes                     VARCHAR(4000) NULL,
  recommendations           VARCHAR(4000) NULL,
  status                    ENUM('RECIBIDO','DIAGNOSTICO','EN_REPARACION','ESPERANDO_REFACCION','TERMINADO','ENTREGADO','CANCELADA') NOT NULL DEFAULT 'RECIBIDO',
  cancel_reason             VARCHAR(255) NULL,
  delivered_at              DATETIME     NULL,
  open_vehicle_id           INT UNSIGNED GENERATED ALWAYS AS (IF(status IN ('ENTREGADO','CANCELADA'), NULL, vehicle_id)) STORED,
  created_by                INT UNSIGNED NOT NULL,
  created_at                DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_folio (folio),
  UNIQUE KEY uq_orders_appointment (appointment_id),
  UNIQUE KEY uq_orders_open_vehicle (open_vehicle_id),
  KEY idx_orders_status (status),
  KEY idx_orders_mechanic_status (mechanic_id, status),
  KEY idx_orders_client (client_id),
  KEY idx_orders_vehicle (vehicle_id),
  CONSTRAINT fk_orders_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles (id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_mechanic FOREIGN KEY (mechanic_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_appointment FOREIGN KEY (appointment_id) REFERENCES appointments (id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE order_services (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id    INT UNSIGNED NOT NULL,
  description VARCHAR(255) NOT NULL,
  cost        DECIMAL(10,2) NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_services_order (order_id),
  CONSTRAINT fk_order_services_order FOREIGN KEY (order_id) REFERENCES service_orders (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE order_labor (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id    INT UNSIGNED NOT NULL,
  description VARCHAR(255) NOT NULL,
  amount      DECIMAL(10,2) NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_labor_order (order_id),
  CONSTRAINT fk_order_labor_order FOREIGN KEY (order_id) REFERENCES service_orders (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE order_status_history (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id    INT UNSIGNED NOT NULL,
  from_status ENUM('RECIBIDO','DIAGNOSTICO','EN_REPARACION','ESPERANDO_REFACCION','TERMINADO','ENTREGADO','CANCELADA') NULL,
  to_status   ENUM('RECIBIDO','DIAGNOSTICO','EN_REPARACION','ESPERANDO_REFACCION','TERMINADO','ENTREGADO','CANCELADA') NOT NULL,
  changed_by  INT UNSIGNED NOT NULL,
  reason      VARCHAR(255) NULL,
  changed_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_history_order (order_id, changed_at),
  CONSTRAINT fk_order_history_order FOREIGN KEY (order_id) REFERENCES service_orders (id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_history_user FOREIGN KEY (changed_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE folio_counters (
  year        SMALLINT UNSIGNED NOT NULL,
  last_number INT UNSIGNED      NOT NULL DEFAULT 0,
  PRIMARY KEY (year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
