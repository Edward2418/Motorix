-- Sprint 1: usuarios, clientes y vehículos.
-- Motor InnoDB, codificación utf8mb4. No editar este script una vez aplicado.

CREATE TABLE users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username      VARCHAR(50)  NOT NULL,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(254) NOT NULL,
  password_hash CHAR(60)     NOT NULL,
  role          ENUM('ADMIN','RECEPTIONIST','MECHANIC') NOT NULL,
  active        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE clients (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100) NOT NULL,
  phone      VARCHAR(20)  NOT NULL,
  email      VARCHAR(254) NULL,
  active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_clients_name (name),
  KEY idx_clients_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE vehicles (
  id              INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  client_id       INT UNSIGNED      NOT NULL,
  brand           VARCHAR(50)       NOT NULL,
  model           VARCHAR(50)       NOT NULL,
  year            SMALLINT UNSIGNED NOT NULL,
  license_plate   VARCHAR(15)       NOT NULL,
  vin             CHAR(17)          NULL,
  current_mileage INT UNSIGNED      NOT NULL DEFAULT 0,
  active          TINYINT(1)        NOT NULL DEFAULT 1,
  created_at      DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vehicles_license_plate (license_plate),
  UNIQUE KEY uq_vehicles_vin (vin),
  KEY idx_vehicles_client (client_id),
  CONSTRAINT fk_vehicles_client FOREIGN KEY (client_id)
    REFERENCES clients (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
