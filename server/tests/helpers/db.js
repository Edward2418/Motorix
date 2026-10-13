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
    'maintenance',
    'inventory_movements',
    'order_parts',
    'parts',
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

// Crea una refacción con su movimiento de ENTRADA «Stock inicial» (si el stock es mayor que cero).
export async function createPart({
  code = 'REF-001',
  name = 'Bujía de prueba',
  category = 'Motor',
  brand = 'NGK',
  stock = 10,
  minStock = 3,
  purchasePrice = 50,
  salePrice = 80,
  active = true,
  createdBy
} = {}) {
  const [result] = await pool.query(
    'INSERT INTO parts (code, name, category, brand, stock, min_stock, purchase_price, sale_price, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [code, name, category, brand, stock, minStock, purchasePrice, salePrice, active ? 1 : 0]
  );
  if (stock > 0) {
    const [rows] = await pool.query('SELECT id FROM users ORDER BY id LIMIT 1');
    const creator = createdBy ?? rows[0]?.id ?? (await createUser({ username: 'creador-inventario', role: 'ADMIN' })).id;
    await pool.query(
      "INSERT INTO inventory_movements (part_id, type, quantity, stock_after, reason, created_by) VALUES (?, 'ENTRADA', ?, ?, 'Stock inicial', ?)",
      [result.insertId, stock, stock, creator]
    );
  }
  return { id: result.insertId, code, name, stock, minStock, salePrice, active };
}

// Agrega una refacción a una orden directamente en la base, con su movimiento SALIDA y descontando el stock.
export async function createOrderPart({ orderId, partId, quantity = 1, createdBy }) {
  const [[part]] = await pool.query('SELECT stock, sale_price FROM parts WHERE id = ?', [partId]);
  const newStock = part.stock - quantity;
  if (newStock < 0) {
    throw new Error('createOrderPart: el stock de prueba no alcanza.');
  }
  const [[order]] = await pool.query('SELECT folio, mechanic_id FROM service_orders WHERE id = ?', [orderId]);
  await pool.query('UPDATE parts SET stock = ? WHERE id = ?', [newStock, partId]);
  const [result] = await pool.query('INSERT INTO order_parts (order_id, part_id, quantity, unit_price) VALUES (?, ?, ?, ?)', [
    orderId,
    partId,
    quantity,
    part.sale_price
  ]);
  await pool.query(
    "INSERT INTO inventory_movements (part_id, type, quantity, stock_after, reason, order_id, created_by) VALUES (?, 'SALIDA', ?, ?, ?, ?, ?)",
    [partId, -quantity, newStock, `Uso en la orden ${order.folio}`, orderId, createdBy ?? order.mechanic_id]
  );
  return { id: result.insertId, orderId, partId, quantity, unitPrice: Number(part.sale_price) };
}

// Programa un mantenimiento directamente en la base. Por defecto: por fecha, dentro de 90 días.
export async function createMaintenance({
  vehicleId,
  orderId,
  description = 'Cambio de aceite',
  dueDate,
  dueMileage = null,
  status = 'PROGRAMADO',
  createdBy
}) {
  const target = dueDate === undefined && dueMileage === null ? new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10) : dueDate ?? null;
  const [[order]] = await pool.query('SELECT mechanic_id FROM service_orders WHERE id = ?', [orderId]);
  const [result] = await pool.query(
    'INSERT INTO maintenance (vehicle_id, order_id, description, due_date, due_mileage, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [vehicleId, orderId, description, target, dueMileage, status, createdBy ?? order.mechanic_id]
  );
  return { id: result.insertId, vehicleId, orderId, description, dueDate: target, dueMileage, status };
}

// Marca una orden como finalizada en el historial: inserta el cambio a TERMINADO en la fecha indicada y,
// si se da, fija el kilometraje del servicio. Sirve para probar el orden cronológico del historial.
export async function markFinished({ orderId, finishedAt, serviceMileage = null, changedBy }) {
  const [[order]] = await pool.query('SELECT mechanic_id FROM service_orders WHERE id = ?', [orderId]);
  await pool.query(
    "INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, changed_at) VALUES (?, 'EN_REPARACION', 'TERMINADO', ?, ?)",
    [orderId, changedBy ?? order.mechanic_id, finishedAt]
  );
  if (serviceMileage !== null) {
    await pool.query('UPDATE service_orders SET service_mileage = ? WHERE id = ?', [serviceMileage, orderId]);
  }
}

// Agrega un servicio o una línea de mano de obra a una orden directamente en la base.
export async function addServiceLine(orderId, description, amount, table = 'order_services') {
  const column = table === 'order_services' ? 'cost' : 'amount';
  await pool.query(`INSERT INTO ${table} (order_id, description, ${column}) VALUES (?, ?, ?)`, [orderId, description, amount]);
}
