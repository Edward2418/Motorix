-- Conciliación del Sprint 1: bloqueo por intentos de inicio de sesión fallidos.
-- La clave es "u:<id>" si el usuario existe o "i:<identificador en minúsculas>" si no existe,
-- de modo que el comportamiento no revela qué cuentas existen. No editar una vez aplicado.

CREATE TABLE login_attempts (
  attempt_key  VARCHAR(255)  NOT NULL,
  failed_count INT UNSIGNED  NOT NULL DEFAULT 0,
  locked_until DATETIME      NULL,
  updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (attempt_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
