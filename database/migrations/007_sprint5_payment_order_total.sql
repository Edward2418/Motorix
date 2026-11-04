-- Sprint 5: todo pago nuevo guarda el total de la orden con el que se creó; sirve para detectar un pago de Mercado Pago
-- pendiente desfasado. Los pagos anteriores quedan con NULL y nunca se marcan como desfasados. Una sola sentencia por
-- archivo, para poder repetir la migración tras un fallo.
ALTER TABLE payments ADD COLUMN order_total_at_creation DECIMAL(10,2) NULL;
