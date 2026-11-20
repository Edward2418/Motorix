-- Protección OPCIONAL de la bitácora (Sprint 7): impide editar o borrar registros de audit_log también con SQL directo.
--
-- NO forma parte de las migraciones y 'npm run db:migrate' no lo ejecuta. Motivo: con el registro binario de MySQL
-- activo (log_bin=1) y sin log_bin_trust_function_creators, CREATE TRIGGER exige el privilegio SUPER, que el usuario
-- dedicado de la aplicación (motorix_app) no tiene a propósito. La inmutabilidad ya está garantizada desde la aplicación
-- (no existe ruta ni función que la modifique y una prueba lo verifica); este script añade una segunda barrera.
--
-- Cómo usarlo: lo ejecuta una persona administradora de MySQL (por ejemplo root) sobre la base principal:
--   mysql -u root -p motorix < database/scripts/audit-log-protection.sql
-- NO se aplica en motorix_test: las pruebas vacían audit_log con DELETE y fallarían.
-- Para quitarlo: DROP TRIGGER trg_audit_log_no_update; DROP TRIGGER trg_audit_log_no_delete;

CREATE TRIGGER IF NOT EXISTS trg_audit_log_no_update BEFORE UPDATE ON audit_log FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La bitácora no se puede modificar';

CREATE TRIGGER IF NOT EXISTS trg_audit_log_no_delete BEFORE DELETE ON audit_log FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La bitácora no se puede borrar';
