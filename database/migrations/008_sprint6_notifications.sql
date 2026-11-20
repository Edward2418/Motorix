-- Sprint 6: notificaciones internas. Los avisos NO se guardan: se calculan al consultar con los datos existentes.
-- Solo se guardan dos cosas nuevas: qué avisos leyó cada usuario y a qué clientes se avisó. Migración aditiva: no
-- modifica ninguna tabla anterior. Usa CREATE TABLE IF NOT EXISTS, de modo que se puede repetir tras un fallo aunque
-- tenga dos sentencias.

-- Lectura de avisos por usuario. La gravedad (1 normal, 2 grave) permite que un aviso leído reaparezca si empeora,
-- por ejemplo de «Próximo» a «Vencido». Si se borra el usuario, se borran sus lecturas.
CREATE TABLE IF NOT EXISTS notification_reads (
  user_id          INT UNSIGNED     NOT NULL,
  notification_key VARCHAR(60)      NOT NULL,
  severity         TINYINT UNSIGNED NOT NULL,
  read_at          DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, notification_key),
  CONSTRAINT fk_notification_reads_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Avisos hechos a clientes. Un hecho (orden, cita o mantenimiento) se avisa una sola vez: la restricción única
-- (reason, fact_key) lo garantiza aunque dos personas registren al mismo tiempo. No se borra: es historial.
CREATE TABLE IF NOT EXISTS client_notices (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id   INT UNSIGNED NOT NULL,
  reason      ENUM('ORDEN_TERMINADA','CITA_MANANA','MANTENIMIENTO_PROXIMO','MANTENIMIENTO_VENCIDO') NOT NULL,
  fact_key    VARCHAR(60)  NOT NULL,
  note        VARCHAR(255) NULL,
  notified_by INT UNSIGNED NOT NULL,
  notified_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_client_notices_fact (reason, fact_key),
  KEY idx_client_notices_client (client_id),
  CONSTRAINT fk_client_notices_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE RESTRICT,
  CONSTRAINT fk_client_notices_user FOREIGN KEY (notified_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
