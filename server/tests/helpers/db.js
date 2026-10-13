import { pool, closePool } from '../../config/db.js';
import { hashPassword } from '../../utils/hash.js';
import { nextFolio } from '../../services/folioService.js';

export { pool, closePool };

// Contraseñas conocidas solo para las pruebas (cuentas creadas en la base motorix_test).
export const TEST_PASSWORD = 'Prueba2026!';

// Vacía las tablas en un orden que respeta las llaves foráneas.
export async function resetTables() {
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  const tables = [
    'login_attempts',
    'order_status_history',
    'order_services',
    'order_labor',
    'service_orders',
    'appointments',
    'folio_counters',
    'vehicles',
    'clients',
    'users'
  ];
  for (const table of tables) {
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

// Crea un mecánico de prueba (usuario activo con rol MECHANIC).
export function createMechanic(overrides = {}) {
  return createUser({ role: 'MECHANIC', username: 'mecanico', ...overrides });
}

// Crea una cita directamente en la base. Por defecto, dentro de dos días.
export async function createAppointment({
  clientId,
  vehicleId,
  createdBy,
  scheduledAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
  reason = 'Revisión general',
  status = 'PENDIENTE'
}) {
  let creator = createdBy;
  if (!creator) {
    const [rows] = await pool.query('SELECT id FROM users LIMIT 1');
    creator = rows[0]?.id ?? (await createUser({ username: 'creador-citas', role: 'RECEPTIONIST' })).id;
  }
  const [result] = await pool.query(
    'INSERT INTO appointments (client_id, vehicle_id, scheduled_at, reason, status, created_by) VALUES (?, ?, ?, ?, ?, ?)',
    [clientId, vehicleId, scheduledAt, reason, status, creator]
  );
  return { id: result.insertId, clientId, vehicleId, status };
}

// Crea una orden directamente en la base, con folio válido e historial inicial.
export async function createOrder({
  clientId,
  vehicleId,
  mechanicId,
  createdBy,
  status = 'RECIBIDO',
  entryMileage = 1000,
  reportedProblem = 'Ruido en el motor',
  appointmentId = null
}) {
  const folio = await nextFolio(pool);
  const creator = createdBy ?? mechanicId;
  const [result] = await pool.query(
    `INSERT INTO service_orders
       (folio, client_id, vehicle_id, mechanic_id, appointment_id, entry_mileage, previous_mileage,
        reported_problem, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [folio, clientId, vehicleId, mechanicId, appointmentId, entryMileage, entryMileage, reportedProblem, status, creator]
  );
  await pool.query('INSERT INTO order_status_history (order_id, from_status, to_status, changed_by) VALUES (?, NULL, ?, ?)', [
    result.insertId,
    status,
    creator
  ]);
  return { id: result.insertId, folio, clientId, vehicleId, mechanicId, status };
}
