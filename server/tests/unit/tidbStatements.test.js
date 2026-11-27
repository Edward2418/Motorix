import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { databaseDir, splitStatements, forTiDB } from '../../scripts/sqlRunner.js';

// TiDB no resuelve, dentro de un mismo ALTER TABLE, una columna que se agrega en esa sentencia. El ejecutor separa las
// cláusulas solo para TiDB: las migraciones no cambian y en MySQL se ejecutan igual que siempre.
const migracion = async (archivo) => splitStatements(await readFile(path.join(databaseDir, 'migrations', archivo), 'utf8'));
const plano = (sql) => sql.replace(/\s+/g, ' ').trim();

describe('sentencias para TiDB', () => {
  test('separa cada cláusula de un ALTER TABLE múltiple, en el mismo orden', async () => {
    const [alter] = await migracion('010_sprint7_order_service_type.sql');

    expect(forTiDB(alter).map(plano)).toEqual([
      'ALTER TABLE order_services ADD COLUMN service_type_id INT UNSIGNED NULL',
      'ALTER TABLE order_services ADD KEY idx_order_services_type (service_type_id)',
      'ALTER TABLE order_services ADD CONSTRAINT fk_order_services_type FOREIGN KEY (service_type_id) REFERENCES service_types (id) ON DELETE RESTRICT'
    ]);
  });

  test('la migración 004 queda en cuatro sentencias y conserva las posiciones de las columnas', async () => {
    const [alter] = await migracion('004_sprint3_maintenance_inventory.sql');

    const partes = forTiDB(alter).map(plano);

    expect(partes).toHaveLength(4);
    expect(partes[1]).toBe('ALTER TABLE service_orders ADD COLUMN service_mileage_correction_reason VARCHAR(255) NULL AFTER service_mileage');
    expect(partes[3]).toMatch(/^ALTER TABLE service_orders ADD CONSTRAINT fk_orders_service_mileage_corrected_by FOREIGN KEY/);
  });

  test('omite solo el CHECK que usa una columna con llave foránea, que TiDB no admite', async () => {
    const movimientos = (await migracion('004_sprint3_maintenance_inventory.sql')).find((s) => /CREATE TABLE inventory_movements/.test(s));

    const [adaptada] = forTiDB(movimientos);

    expect(adaptada).not.toContain('chk_movements_salida_order');
    expect(adaptada).toContain('chk_movements_sign');
    expect(adaptada).toContain('fk_movements_order');
    expect(adaptada.trim()).toMatch(/\) ENGINE=InnoDB .*utf8mb4_0900_ai_ci$/);
  });

  test('las demás tablas con CHECK no cambian en ninguna migración', async () => {
    const cambiadas = [];
    for (const archivo of await readdir(path.join(databaseDir, 'migrations'))) {
      for (const sentencia of await migracion(archivo)) {
        if (/^CREATE TABLE/i.test(sentencia) && forTiDB(sentencia)[0] !== sentencia) {
          cambiadas.push(/CREATE TABLE(?: IF NOT EXISTS)? (\w+)/.exec(sentencia)[1]);
        }
      }
    }

    expect(cambiadas).toEqual(['inventory_movements']);
  });

  test('no parte por las comas que están entre paréntesis o comillas', () => {
    const sql = "ALTER TABLE t ADD COLUMN precio DECIMAL(10,2) NULL, ADD COLUMN estado ENUM('A,B','C') NOT NULL DEFAULT 'A,B'";

    expect(forTiDB(sql)).toEqual([
      'ALTER TABLE t ADD COLUMN precio DECIMAL(10,2) NULL',
      "ALTER TABLE t ADD COLUMN estado ENUM('A,B','C') NOT NULL DEFAULT 'A,B'"
    ]);
  });

  test.each([
    'ALTER TABLE tickets ADD COLUMN content JSON NULL',
    'CREATE TABLE t (a INT, b INT)',
    "INSERT INTO t (a, b) VALUES (1, 'x, y')"
  ])('deja igual «%s»', (sql) => {
    expect(forTiDB(sql)).toEqual([sql]);
  });
});
