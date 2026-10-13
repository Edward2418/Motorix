import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, resetTables, closePool } from '../helpers/db.js';
import { runSeeds } from '../../scripts/sqlRunner.js';
import { comparePassword } from '../../utils/hash.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

// Las contraseñas del estándar del MVP se leen de docs/project-context.md para no escribirlas
// en el código de la aplicación ni de las pruebas.
async function standardPasswords() {
  const text = await readFile(path.join(root, 'docs/project-context.md'), 'utf8');
  const passwords = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\|\s*[^|]+\|\s*`([a-z]+)`\s*\|\s*`([^`]+)`\s*\|$/);
    if (match) {
      passwords[match[1]] = match[2];
    }
  }
  return passwords;
}

const count = async (table) => (await pool.query(`SELECT COUNT(*) AS total FROM ${table}`))[0][0].total;

afterAll(closePool);

describe('seeds', () => {
  beforeEach(resetTables);

  test('carga usuarios, clientes y vehículos de ejemplo y repetir el seed no duplica registros', async () => {
    await runSeeds(pool, () => {});
    const primera = { users: await count('users'), clients: await count('clients'), vehicles: await count('vehicles') };
    await runSeeds(pool, () => {});
    const segunda = { users: await count('users'), clients: await count('clients'), vehicles: await count('vehicles') };

    expect(primera).toEqual({ users: 3, clients: 8, vehicles: 12 });
    expect(segunda).toEqual(primera);
  });

  test('las cuentas iniciales guardan la contraseña del estándar solo como hash bcrypt', async () => {
    await runSeeds(pool, () => {});
    const passwords = await standardPasswords();
    expect(Object.keys(passwords).sort()).toEqual(['admin', 'mecanico', 'recepcion']);

    const [rows] = await pool.query('SELECT username, role, password_hash FROM users ORDER BY username');
    expect(rows.map((row) => `${row.username}:${row.role}`)).toEqual([
      'admin:ADMIN',
      'mecanico:MECHANIC',
      'recepcion:RECEPTIONIST'
    ]);
    for (const row of rows) {
      expect(row.password_hash).toMatch(/^\$2[aby]\$\d{2}\$/);
      expect(row.password_hash).not.toBe(passwords[row.username]);
      expect(await comparePassword(passwords[row.username], row.password_hash)).toBe(true);
    }
  });
});

describe('integridad de los datos de ejemplo', () => {
  beforeEach(resetTables);

  test('todos los vehículos de ejemplo tienen propietario y un cliente sin vehículos', async () => {
    await runSeeds(pool, () => {});
    const [huerfanos] = await pool.query(
      'SELECT COUNT(*) AS total FROM vehicles v LEFT JOIN clients c ON c.id = v.client_id WHERE c.id IS NULL'
    );
    expect(huerfanos[0].total).toBe(0);

    const [sinVehiculos] = await pool.query(
      'SELECT COUNT(*) AS total FROM clients c WHERE c.active = 1 AND NOT EXISTS (SELECT 1 FROM vehicles v WHERE v.client_id = c.id)'
    );
    expect(sinVehiculos[0].total).toBe(1);
  });

  test('ningún cliente desactivado conserva vehículos activos', async () => {
    await runSeeds(pool, () => {});
    const [rows] = await pool.query(
      'SELECT COUNT(*) AS total FROM vehicles v JOIN clients c ON c.id = v.client_id WHERE c.active = 0 AND v.active = 1'
    );
    expect(rows[0].total).toBe(0);
  });
});
