-- Sprint 3: kilometraje del servicio, catálogo e inventario de refacciones, refacciones de la orden y
-- mantenimientos programados. Motor InnoDB, codificación utf8mb4. No editar este script una vez aplicado.

-- Kilometraje con el que se terminó el servicio (obligatorio al pasar a TERMINADO; lo exige el servicio).
ALTER TABLE service_orders
  ADD COLUMN service_mileage INT UNSIGNED NULL AFTER previous_mileage,
  ADD COLUMN service_mileage_correction_reason VARCHAR(255) NULL AFTER service_mileage,
  ADD COLUMN service_mileage_corrected_by INT UNSIGNED NULL AFTER service_mileage_correction_reason,
  ADD CONSTRAINT fk_orders_service_mileage_corrected_by
    FOREIGN KEY (service_mileage_corrected_by) REFERENCES users (id) ON DELETE RESTRICT;

-- Las órdenes que ya estaban finalizadas toman su kilometraje de entrada como kilometraje del servicio.
UPDATE service_orders
SET service_mileage = entry_mileage
WHERE status IN ('TERMINADO', 'ENTREGADO') AND service_mileage IS NULL;

CREATE TABLE parts (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  code           VARCHAR(40)   NOT NULL,
  name           VARCHAR(120)  NOT NULL,
  category       VARCHAR(60)   NOT NULL,
  brand          VARCHAR(60)   NOT NULL,
  stock          INT UNSIGNED  NOT NULL DEFAULT 0,
  min_stock      INT UNSIGNED  NOT NULL DEFAULT 0,
  purchase_price DECIMAL(10,2) NOT NULL,
  sale_price     DECIMAL(10,2) NOT NULL,
  active         TINYINT(1)    NOT NULL DEFAULT 1,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_parts_code (code),
  KEY idx_parts_active_stock (active, stock),
  KEY idx_parts_category (category),
  CONSTRAINT chk_parts_stock CHECK (stock >= 0),
  CONSTRAINT chk_parts_purchase_price CHECK (purchase_price >= 0),
  CONSTRAINT chk_parts_sale_price CHECK (sale_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Movimientos inmutables: el stock de `parts` es siempre la suma de `quantity` (con signo) de sus movimientos.
CREATE TABLE inventory_movements (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  part_id     INT UNSIGNED NOT NULL,
  type        ENUM('ENTRADA','SALIDA','AJUSTE') NOT NULL,
  quantity    INT          NOT NULL,
  stock_after INT UNSIGNED NOT NULL,
  reason      VARCHAR(255) NOT NULL,
  order_id    INT UNSIGNED NULL,
  created_by  INT UNSIGNED NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_movements_part (part_id, created_at, id),
  KEY idx_movements_order (order_id),
  CONSTRAINT fk_movements_part FOREIGN KEY (part_id) REFERENCES parts (id) ON DELETE RESTRICT,
  CONSTRAINT fk_movements_order FOREIGN KEY (order_id) REFERENCES service_orders (id) ON DELETE RESTRICT,
  CONSTRAINT fk_movements_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT chk_movements_sign CHECK (
    (type = 'ENTRADA' AND quantity > 0) OR (type = 'SALIDA' AND quantity < 0) OR (type = 'AJUSTE' AND quantity <> 0)
  ),
  CONSTRAINT chk_movements_salida_order CHECK (type <> 'SALIDA' OR order_id IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Una línea por refacción en cada orden; `unit_price` es el precio de venta copiado al agregarla.
CREATE TABLE order_parts (
  id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  order_id   INT UNSIGNED  NOT NULL,
  part_id    INT UNSIGNED  NOT NULL,
  quantity   INT UNSIGNED  NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_parts_order_part (order_id, part_id),
  KEY idx_order_parts_part (part_id),
  CONSTRAINT fk_order_parts_order FOREIGN KEY (order_id) REFERENCES service_orders (id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_parts_part FOREIGN KEY (part_id) REFERENCES parts (id) ON DELETE RESTRICT,
  CONSTRAINT chk_order_parts_quantity CHECK (quantity >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Próximos mantenimientos de un vehículo. El estado visual (Normal, Próximo, Vencido) se calcula al consultar.
CREATE TABLE maintenance (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  vehicle_id         INT UNSIGNED NOT NULL,
  order_id           INT UNSIGNED NOT NULL,
  description        VARCHAR(255) NOT NULL,
  due_date           DATE         NULL,
  due_mileage        INT UNSIGNED NULL,
  notes              VARCHAR(1000) NULL,
  status             ENUM('PROGRAMADO','ATENDIDO','CANCELADO') NOT NULL DEFAULT 'PROGRAMADO',
  cancel_reason      VARCHAR(255) NULL,
  fulfilled_order_id INT UNSIGNED NULL,
  closed_at          DATETIME     NULL,
  closed_by          INT UNSIGNED NULL,
  pending_vehicle_id INT UNSIGNED GENERATED ALWAYS AS (IF(status = 'PROGRAMADO', vehicle_id, NULL)) STORED,
  created_by         INT UNSIGNED NOT NULL,
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_maintenance_pending (pending_vehicle_id, description),
  KEY idx_maintenance_vehicle_status (vehicle_id, status),
  KEY idx_maintenance_status (status),
  KEY idx_maintenance_order (order_id),
  CONSTRAINT fk_maintenance_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles (id) ON DELETE RESTRICT,
  CONSTRAINT fk_maintenance_order FOREIGN KEY (order_id) REFERENCES service_orders (id) ON DELETE RESTRICT,
  CONSTRAINT fk_maintenance_fulfilled_order FOREIGN KEY (fulfilled_order_id) REFERENCES service_orders (id) ON DELETE RESTRICT,
  CONSTRAINT fk_maintenance_closed_by FOREIGN KEY (closed_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_maintenance_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT chk_maintenance_target CHECK (due_date IS NOT NULL OR due_mileage IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
