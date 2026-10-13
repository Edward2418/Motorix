-- Crea las bases de datos locales de Motorix y el usuario dedicado de la aplicación.
-- Ejecutar UNA vez con una cuenta administrativa de MySQL (por ejemplo, root), reemplazando
-- la contraseña de ejemplo por una propia:
--
--   mysql -u root -p < database/scripts/create-database.sql
--
-- La contraseña que definas aquí es la que debes poner en DB_PASSWORD (archivos .env y .env.test).
-- No subas contraseñas reales al repositorio.

CREATE DATABASE IF NOT EXISTS motorix
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE DATABASE IF NOT EXISTS motorix_test
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'motorix_app'@'localhost' IDENTIFIED BY 'CAMBIAR_CONTRASENA_LOCAL';

GRANT ALL PRIVILEGES ON motorix.* TO 'motorix_app'@'localhost';
GRANT ALL PRIVILEGES ON motorix_test.* TO 'motorix_app'@'localhost';

FLUSH PRIVILEGES;
