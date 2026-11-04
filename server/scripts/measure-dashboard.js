// Mide el tiempo del panel de control con datos de carga (SC-008 del Sprint 4, FR-025 del Sprint 5): 2 000 órdenes,
// 5 000 movimientos de inventario, pagos y tickets sintéticos. Falla (código de salida 1) si el panel tarda 3 segundos o más.
//
// Uso, desde `server/` y siempre contra la base de pruebas:
//   node --env-file=../.env.test scripts/measure-dashboard.js [--keep]
//
// Se niega a ejecutarse si `DB_NAME` no es `motorix_test`: vacía las tablas antes de cargar los datos. Al terminar las
// vuelve a vaciar, salvo que se indique `--keep` (para inspeccionar los datos de carga).
import { pathToFileURL } from 'node:url';
import { pool, closePool } from '../config/db.js';
import { env } from '../config/env.js';
import { getDashboard } from '../services/dashboardService.js';
import { hashPassword } from '../utils/hash.js';

const LIMIT_MS = 3000;
const REPETITIONS = 5;
const COUNTS = { clients: 200, vehicles: 400, parts: 60, orders: 2000, movements: 5000, tickets: 500, openOrders: 300 };

const TABLES = [
  'login_attempts', 'payments', 'tickets', 'ticket_folio_counters', 'maintenance', 'inventory_movements',
  'order_parts', 'parts', 'order_status_history', 'order_services', 'order_labor', 'service_orders', 'appointments',
  'folio_counters', 'vehicles', 'clients', 'users'
];
const OPEN_STATUSES = ['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION', 'TERMINADO'];

async function truncateAll() {
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of TABLES) {
    await pool.query(`TRUNCATE TABLE ${table}`);
  }
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
}

// Inserta filas por lotes con la sintaxis `VALUES ?` de mysql2.
async function bulkInsert(table, columns, rows, batch = 500) {
  for (let index = 0; index < rows.length; index += batch) {
    await pool.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES ?`, [rows.slice(index, index + batch)]);
  }
}

const daysAgo = (days) => new Date(Date.now() - days * 86400000);
const pad = (value, size = 4) => String(value).padStart(size, '0');

async function loadData() {
  const hash = await hashPassword('Carga2026!');
  await bulkInsert('users', ['username', 'name', 'email', 'password_hash', 'role', 'active'], [
    ['carga.admin', 'Administrador de carga', 'carga.admin@motorix.test', hash, 'ADMIN', 1],
    ['carga.mecanico', 'Mecánico de carga', 'carga.mecanico@motorix.test', hash, 'MECHANIC', 1]
  ]);
  const [users] = await pool.query('SELECT id, role FROM users');
  const adminId = users.find((user) => user.role === 'ADMIN').id;
  const mechanicId = users.find((user) => user.role === 'MECHANIC').id;

  await bulkInsert('clients', ['name', 'phone', 'email', 'active'],
    Array.from({ length: COUNTS.clients }, (_, i) => [`Cliente de carga ${i + 1}`, `55${pad(i + 1, 8)}`, null, 1]));
  const [clients] = await pool.query('SELECT id FROM clients ORDER BY id');

  await bulkInsert('vehicles', ['client_id', 'brand', 'model', 'year', 'license_plate', 'vin', 'active'],
    Array.from({ length: COUNTS.vehicles }, (_, i) => [clients[i % clients.length].id, 'Nissan', 'Versa', 2020, `CAR${pad(i + 1)}`, null, 1]));
  const [vehicles] = await pool.query('SELECT id, client_id FROM vehicles ORDER BY id');

  await bulkInsert('parts', ['code', 'name', 'category', 'brand', 'stock', 'min_stock', 'purchase_price', 'sale_price', 'active'],
    Array.from({ length: COUNTS.parts }, (_, i) => [`CAR-${pad(i + 1)}`, `Refacción de carga ${i + 1}`, 'Motor', 'NGK', 100000, 5, 50 + i, 80 + i, 1]));
  const [parts] = await pool.query('SELECT id, sale_price FROM parts ORDER BY id');

  // Órdenes: las primeras quedan abiertas (una por vehículo, como exige el índice único); el resto, entregadas o canceladas.
  const orders = [];
  for (let i = 0; i < COUNTS.orders; i += 1) {
    const open = i < COUNTS.openOrders;
    const vehicle = open ? vehicles[i] : vehicles[i % vehicles.length];
    const status = open ? OPEN_STATUSES[i % OPEN_STATUSES.length] : i % 6 === 0 ? 'CANCELADA' : 'ENTREGADO';
    orders.push({
      folio: `OS-2026-${pad(i + 1)}`, vehicle, status, createdAt: daysAgo(25 - (i % 25)),
      delivered: status === 'ENTREGADO' ? daysAgo(24 - (i % 24)) : null
    });
  }
  await bulkInsert('service_orders',
    ['folio', 'client_id', 'vehicle_id', 'mechanic_id', 'appointment_id', 'entry_mileage', 'previous_mileage', 'reported_problem',
      'status', 'cancel_reason', 'delivered_at', 'service_mileage', 'created_by', 'created_at'],
    orders.map((o) => [o.folio, o.vehicle.client_id, o.vehicle.id, mechanicId, null, 1000, 1000, 'Revisión general', o.status,
      o.status === 'CANCELADA' ? 'Cancelada en la carga' : null, o.delivered, o.status === 'ENTREGADO' ? 1010 : null, adminId, o.createdAt]));
  const [stored] = await pool.query('SELECT id, folio FROM service_orders ORDER BY id');
  stored.forEach((row, index) => { orders[index].id = row.id; });

  const history = [];
  const services = [];
  const labor = [];
  const orderParts = [];
  const payments = [];
  const tickets = [];
  orders.forEach((order, index) => {
    history.push([order.id, null, 'RECIBIDO', adminId, null, order.createdAt]);
    const finished = order.status === 'TERMINADO' || order.status === 'ENTREGADO';
    if (finished) {
      history.push([order.id, 'EN_REPARACION', 'TERMINADO', mechanicId, null, new Date(order.createdAt.getTime() + 3600000)]);
    }
    const serviceCost = 500;
    services.push([order.id, 'Servicio de carga', serviceCost]);
    let total = serviceCost;
    if (index % 2 === 0) {
      labor.push([order.id, 'Mano de obra de carga', 200]);
      total += 200;
    }
    if (index % 5 < 3) {
      const part = parts[index % parts.length];
      const quantity = (index % 3) + 1;
      orderParts.push([order.id, part.id, quantity, part.sale_price]);
      total += quantity * Number(part.sale_price);
    }
    if (finished && index % 10 < 7) {
      const amount = index % 4 === 0 ? Math.round(total * 50) / 100 : total;
      const paidAt = new Date(order.createdAt.getTime() + 7200000);
      payments.push([order.id, amount, 'EFECTIVO', 'PAGADO', paidAt, total, adminId]);
    }
    if (order.status === 'ENTREGADO' && tickets.length < COUNTS.tickets) {
      tickets.push([`TK-2026-${pad(tickets.length + 1)}`, order.id, total, adminId]);
    }
  });
  await bulkInsert('order_status_history', ['order_id', 'from_status', 'to_status', 'changed_by', 'reason', 'changed_at'], history);
  await bulkInsert('order_services', ['order_id', 'description', 'cost'], services);
  await bulkInsert('order_labor', ['order_id', 'description', 'amount'], labor);
  await bulkInsert('order_parts', ['order_id', 'part_id', 'quantity', 'unit_price'], orderParts);
  await bulkInsert('payments', ['order_id', 'amount', 'method', 'status', 'paid_at', 'order_total_at_creation', 'created_by'], payments);
  await bulkInsert('tickets', ['folio', 'order_id', 'order_total', 'generated_by'], tickets);

  const movements = Array.from({ length: COUNTS.movements }, (_, i) => {
    const part = parts[i % parts.length];
    return [part.id, 'ENTRADA', (i % 20) + 1, 100000, `Movimiento de carga ${i + 1}`, adminId, daysAgo(i % 25)];
  });
  await bulkInsert('inventory_movements', ['part_id', 'type', 'quantity', 'stock_after', 'reason', 'created_by', 'created_at'], movements);
  return { orders: orders.length, movements: movements.length, payments: payments.length, tickets: tickets.length };
}

async function measure(repetitions = REPETITIONS) {
  const times = [];
  for (let i = 0; i < repetitions; i += 1) {
    const start = process.hrtime.bigint();
    await getDashboard('month');
    times.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  return times;
}

// Hallazgo H-17 del Sprint 5: justo después de una carga masiva, con las estadísticas de MySQL desactualizadas, las
// primeras consultas del panel tardaron de 4 a 8 segundos; con las estadísticas al día tardan unos 200 ms. Por eso se
// mide en las dos situaciones: la primera solo se informa y la segunda es la que decide si el script falla.
async function refreshStatistics() {
  for (const table of ['service_orders', 'order_services', 'order_labor', 'order_parts', 'payments', 'order_status_history', 'inventory_movements', 'parts', 'tickets']) {
    await pool.query(`ANALYZE TABLE ${table}`);
  }
}

const describeTimes = (times) =>
  `mínimo ${Math.min(...times).toFixed(0)} ms, promedio ${(times.reduce((sum, value) => sum + value, 0) / times.length).toFixed(0)} ms, máximo ${Math.max(...times).toFixed(0)} ms`;

export async function main({ keep = false } = {}) {
  if (env.db.name !== 'motorix_test') {
    throw new Error(`Este script solo puede ejecutarse contra "motorix_test" (DB_NAME actual: "${env.db.name}").`);
  }
  await truncateAll();
  try {
    const loaded = await loadData();
    console.log(`Datos de carga: ${loaded.orders} órdenes, ${loaded.movements} movimientos de inventario, ${loaded.payments} pagos y ${loaded.tickets} tickets.`);
    const cold = await measure(3);
    console.log(`Justo después de la carga, sin actualizar las estadísticas (3 consultas, solo informativo): ${describeTimes(cold)}.`);
    await refreshStatistics();
    const times = await measure();
    const max = Math.max(...times);
    console.log(`Panel de control con las estadísticas al día (${REPETITIONS} consultas): ${describeTimes(times)} (límite ${LIMIT_MS} ms).`);
    if (max >= LIMIT_MS) {
      console.error('FALLA: el panel tardó 3 segundos o más.');
      process.exitCode = 1;
    } else {
      console.log('OK: el panel carga en menos de 3 segundos.');
    }
  } finally {
    if (!keep) {
      await truncateAll();
    }
  }
}

// Uso: node --env-file=../.env.test scripts/measure-dashboard.js [--keep]
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main({ keep: process.argv.includes('--keep') });
  } catch (error) {
    console.error('Error al medir el panel:', error.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
