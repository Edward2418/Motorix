-- Vehículos de ejemplo asociados a los clientes de ejemplo (seed 002).
-- Idempotente: cada vehículo se inserta solo si no existe uno con la misma placa.
-- Laura Mendoza queda sin vehículos; el vehículo del cliente desactivado también está desactivado.

INSERT INTO vehicles (client_id, brand, model, year, license_plate, vin, current_mileage, active)
SELECT c.id, d.brand, d.model, d.year, d.license_plate, d.vin, d.current_mileage, d.active
FROM (
  SELECT 'Carlos Hernández' AS client_name, '55 1234 5601' AS client_phone, 'Nissan' AS brand, 'Versa' AS model, 2019 AS year, 'HRN4521' AS license_plate, '3N1CN7AP5KL812345' AS vin, 68250 AS current_mileage, 1 AS active
  UNION ALL SELECT 'Carlos Hernández', '55 1234 5601', 'Volkswagen', 'Jetta', 2016, 'JTT8830', NULL, 112400, 1
  UNION ALL SELECT 'María Fernanda López', '55 1234 5602', 'Toyota', 'Corolla', 2021, 'MFL2210', '5YFBURHE1MP123456', 31800, 1
  UNION ALL SELECT 'María Fernanda López', '55 1234 5602', 'Mazda', 'CX-5', 2018, 'MZD5103', NULL, 84900, 1
  UNION ALL SELECT 'José Luis Ramírez', '55 1234 5603', 'Chevrolet', 'Aveo', 2014, 'JLR7745', NULL, 156000, 1
  UNION ALL SELECT 'Ana Sofía Torres', '55 1234 5604', 'Honda', 'Civic', 2020, 'AST3318', '2HGFC2F59LH512345', 42100, 1
  UNION ALL SELECT 'Ana Sofía Torres', '55 1234 5604', 'Kia', 'Rio', 2017, 'AST9067', NULL, 97650, 1
  UNION ALL SELECT 'Transportes Delgado', '55 1234 5605', 'Nissan', 'NP300', 2018, 'TDE1001', NULL, 203500, 1
  UNION ALL SELECT 'Transportes Delgado', '55 1234 5605', 'Ford', 'Transit', 2019, 'TDE1002', '1FTYR1ZM5KKA12345', 178300, 1
  UNION ALL SELECT 'Transportes Delgado', '55 1234 5605', 'Chevrolet', 'Express', 2015, 'TDE1003', NULL, 241900, 1
  UNION ALL SELECT 'Roberto Castillo', '55 1234 5606', 'Toyota', 'Hilux', 2022, 'RCA6620', NULL, 22400, 1
  UNION ALL SELECT 'Refaccionaria El Tornillo', '55 1234 5608', 'Nissan', 'Tsuru', 2010, 'RET0455', NULL, 289000, 0
) AS d
JOIN clients c ON c.name = d.client_name AND c.phone = d.client_phone
WHERE NOT EXISTS (
  SELECT 1 FROM vehicles v WHERE v.license_plate = d.license_plate
);
