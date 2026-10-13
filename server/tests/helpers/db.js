import { pool, closePool } from '../../config/db.js';
import { hashPassword } from '../../utils/hash.js';

export { pool, closePool };

// Contraseñas conocidas solo para las pruebas (cuentas creadas en la base motorix_test).
export const TEST_PASSWORD = 'Prueba2026!';

// Vacía las tablas en un orden que respeta las llaves foráneas.
export async function resetTables() {
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of ['vehicles', 'clients', 'users']) {
    await pool.query(`TRUNCATE TABLE ${table}`);
  }
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
}

// Crea un usuario de prueba y devuelve sus datos. El rol también define el nombre de usuario.
export async function createUser({
  username,
  role = 'RECEPTIONIST',
  password = TEST_PASSWORD,
  active = true,
  email,
  name
} = {}) {
  const user = username ?? role.toLowerCase();
  const passwordHash = await hashPassword(password);
  const [result] = await pool.query(
    'INSERT INTO users (username, name, email, password_hash, role, active) VALUES (?, ?, ?, ?, ?, ?)',
    [user, name ?? `Usuario ${user}`, email ?? `${user}@motorix.test`, passwordHash, role, active ? 1 : 0]
  );
  return { id: result.insertId, username: user, email: email ?? `${user}@motorix.test`, role, password };
}

export async function createClient({ name = 'Cliente de prueba', phone = '5551234567', email = null, active = true } = {}) {
  const [result] = await pool.query('INSERT INTO clients (name, phone, email, active) VALUES (?, ?, ?, ?)', [
    name,
    phone,
    email,
    active ? 1 : 0
  ]);
  return { id: result.insertId, name, phone, email, active };
}

export async function createVehicle({
  clientId,
  brand = 'Nissan',
  model = 'Versa',
  year = 2020,
  licensePlate = 'ABC1234',
  vin = null,
  active = true
}) {
  const [result] = await pool.query(
    'INSERT INTO vehicles (client_id, brand, model, year, license_plate, vin, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [clientId, brand, model, year, licensePlate, vin, active ? 1 : 0]
  );
  return { id: result.insertId, clientId, licensePlate };
}
