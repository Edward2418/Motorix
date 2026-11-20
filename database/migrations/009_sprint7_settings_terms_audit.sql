-- Sprint 7: reportes y configuración. Cinco tablas nuevas: configuración del taller, catálogo de tipos de servicio,
-- versiones de los términos y su aceptación, y la bitácora de acciones sensibles. Los reportes NO se guardan: se calculan
-- al consultar. Migración aditiva: no modifica ninguna tabla anterior (la columna nueva de order_services va en la 010,
-- porque ADD COLUMN no se puede repetir). Usa CREATE TABLE IF NOT EXISTS, de modo que se puede repetir tras un fallo.
-- No crea disparadores: con el registro binario de MySQL activo exigen SUPER, que el usuario del proyecto no tiene
-- (ver database/scripts/audit-log-protection.sql para la protección opcional de la bitácora).

-- Configuración del taller en pares clave y valor. Las claves permitidas son una lista cerrada en el servidor.
CREATE TABLE IF NOT EXISTS settings (
  setting_key   VARCHAR(50)  NOT NULL,
  setting_value VARCHAR(255) NOT NULL,
  updated_by    INT UNSIGNED NOT NULL,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key),
  CONSTRAINT fk_settings_user FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Catálogo de tipos de servicio con su intervalo. Nunca se borra: un tipo usado se desactiva. Debe tener al menos un
-- intervalo (en días, en kilómetros o en ambos).
CREATE TABLE IF NOT EXISTS service_types (
  id            INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  name          VARCHAR(80)       NOT NULL,
  interval_days SMALLINT UNSIGNED NULL,
  interval_km   INT UNSIGNED      NULL,
  active        TINYINT(1)        NOT NULL DEFAULT 1,
  created_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_types_name (name),
  CONSTRAINT chk_service_types_interval CHECK (interval_days IS NOT NULL OR interval_km IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Versiones de los términos y condiciones y del aviso de privacidad. La vigente es la de mayor número. Una versión
-- publicada no se modifica: las nuevas se publican con server/scripts/publish-terms.js.
CREATE TABLE IF NOT EXISTS terms_versions (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  version      INT UNSIGNED NOT NULL,
  terms_text   MEDIUMTEXT   NOT NULL,
  privacy_text MEDIUMTEXT   NOT NULL,
  published_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_terms_versions_version (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Aceptación de una versión por un usuario: quién, cuál versión y cuándo. Aceptar dos veces la misma no duplica el registro.
CREATE TABLE IF NOT EXISTS terms_acceptances (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id          INT UNSIGNED NOT NULL,
  terms_version_id INT UNSIGNED NOT NULL,
  accepted_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_terms_acceptances_user_version (user_id, terms_version_id),
  CONSTRAINT fk_terms_acceptances_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_terms_acceptances_version FOREIGN KEY (terms_version_id) REFERENCES terms_versions (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Bitácora de acciones sensibles. Nunca guarda contraseñas, hashes, tokens ni datos de tarjeta. No tiene llave foránea
-- en user_id a propósito: la bitácora no debe depender de otras tablas ni impedir nada. La aplicación no tiene ninguna
-- operación que la edite o la borre.
CREATE TABLE IF NOT EXISTS audit_log (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED    NULL,
  actor      VARCHAR(50)     NULL,
  action     VARCHAR(40)     NOT NULL,
  entity     VARCHAR(40)     NULL,
  entity_id  INT UNSIGNED    NULL,
  detail     VARCHAR(255)    NULL,
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_created (created_at, id),
  KEY idx_audit_user (user_id, created_at),
  KEY idx_audit_action (action, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
