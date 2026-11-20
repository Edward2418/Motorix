-- Sprint 7: enlace opcional entre una línea de servicio de una orden y su tipo de servicio. Va en un archivo propio y con
-- UNA sola sentencia porque ADD COLUMN no se puede repetir en MySQL y el ejecutor registra cada migración solo al
-- terminarla (igual que la 006 y la 007 del Sprint 5). Las líneas existentes quedan con el tipo nulo.
ALTER TABLE order_services
  ADD COLUMN service_type_id INT UNSIGNED NULL,
  ADD KEY idx_order_services_type (service_type_id),
  ADD CONSTRAINT fk_order_services_type FOREIGN KEY (service_type_id) REFERENCES service_types (id) ON DELETE RESTRICT;
