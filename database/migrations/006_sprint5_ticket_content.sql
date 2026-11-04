-- Sprint 5: el ticket nuevo guarda su contenido al emitirse (conceptos e importes). Los tickets anteriores quedan con
-- NULL y se siguen armando con los datos vigentes. Una sola sentencia por archivo: el ejecutor aplica las sentencias
-- una por una, sin transacción, y así la migración se puede repetir tras un fallo.
ALTER TABLE tickets ADD COLUMN content JSON NULL;
