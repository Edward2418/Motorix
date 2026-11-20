// Mide el centro de notificaciones y su contador con datos de carga (SC-005 del Sprint 6): 2 000 órdenes, 5 000
// movimientos de inventario, 400 mantenimientos y 150 citas de hoy, con cientos de órdenes detenidas. Falla (código de
// salida 1) si el centro tarda 2 segundos o más, o si el panel de control (que no debe empeorar) tarda 3 segundos o más.
//
// Uso, desde `server/` y siempre contra la base de pruebas:
//   node --env-file=../.env.test scripts/measure-notifications.js [--keep]
//
// Se niega a ejecutarse si `DB_NAME` no es `motorix_test`: vacía las tablas antes de cargar los datos.
import { pathToFileURL } from 'node:url';
import { pool, closePool } from '../config/db.js';
import { env } from '../config/env.js';
import { getDashboard } from '../services/dashboardService.js';
import { notificationService } from '../services/notificationService.js';
import { describeTimes, loadData, refreshStatistics, truncateAll } from './measure-dashboard.js';

const CENTER_LIMIT_MS = 2000;
const DASHBOARD_LIMIT_MS = 3000;
const REPETITIONS = 5;
const EXTRA = { maintenance: 400, appointmentsToday: 150 };

const dateOnly = (date) => date.toISOString().slice(0, 10);

// Mantenimientos (vencidos, próximos y normales) sobre las órdenes entregadas, y citas de hoy.
async function loadNotificationData() {
  const [[admin]] = await pool.query("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1");
  const [orders] = await pool.query(
    "SELECT id, vehicle_id, client_id FROM service_orders WHERE status = 'ENTREGADO' ORDER BY id LIMIT ?",
    [EXTRA.maintenance]
  );
  const maintenance = orders.map((order, index) => {
    const offset = (index % 60) - 20; // de 20 días vencido a 39 por delante
    return [order.vehicle_id, order.id, `Mantenimiento de carga ${index + 1}`, dateOnly(new Date(Date.now() + offset * 86400000)), null, 'PROGRAMADO', admin.id];
  });
  for (let i = 0; i < maintenance.length; i += 500) {
    await pool.query(
      'INSERT IGNORE INTO maintenance (vehicle_id, order_id, description, due_date, due_mileage, status, created_by) VALUES ?',
      [maintenance.slice(i, i + 500)]
    );
  }
  const [vehicles] = await pool.query('SELECT id, client_id FROM vehicles ORDER BY id LIMIT ?', [EXTRA.appointmentsToday]);
  const noon = new Date();
  noon.setHours(12, 0, 0, 0);
  await pool.query('INSERT INTO appointments (client_id, vehicle_id, scheduled_at, reason, status, created_by) VALUES ?', [
    vehicles.map((vehicle, index) => [vehicle.client_id, vehicle.id, new Date(noon.getTime() + index * 60000), `Cita de carga ${index + 1}`, index % 2 === 0 ? 'PENDIENTE' : 'CONFIRMADA', admin.id])
  ]);
  const [[{ stale }]] = await pool.query(
    "SELECT COUNT(*) AS stale FROM service_orders WHERE status IN ('RECIBIDO','DIAGNOSTICO','EN_REPARACION','ESPERANDO_REFACCION')"
  );
  return { maintenance: maintenance.length, appointments: vehicles.length, openOrders: Number(stale) };
}

async function timeIt(action, repetitions = REPETITIONS) {
  const times = [];
  for (let i = 0; i < repetitions; i += 1) {
    const start = process.hrtime.bigint();
    await action();
    times.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  return times;
}

export async function main({ keep = false } = {}) {
  if (env.db.name !== 'motorix_test') {
    throw new Error(`Este script solo puede ejecutarse contra "motorix_test" (DB_NAME actual: "${env.db.name}").`);
  }
  await truncateAll();
  try {
    const loaded = await loadData();
    const extra = await loadNotificationData();
    console.log(
      `Datos de carga: ${loaded.orders} órdenes (${extra.openOrders} abiertas), ${loaded.movements} movimientos, ${extra.maintenance} mantenimientos y ${extra.appointments} citas de hoy.`
    );
    await refreshStatistics();
    await pool.query('ANALYZE TABLE maintenance');
    await pool.query('ANALYZE TABLE appointments');
    const [[admin]] = await pool.query("SELECT id, role FROM users WHERE role = 'ADMIN' LIMIT 1");

    const center = await timeIt(() => notificationService.getCenter(admin));
    const count = await timeIt(() => notificationService.getUnreadCount(admin));
    const dashboard = await timeIt(() => getDashboard('month'));
    const sample = await notificationService.getCenter(admin);
    console.log(`Avisos del administrador: ${sample.groups.map((g) => `${g.type} ${g.total}`).join(', ')}.`);
    console.log(`Centro de notificaciones (${REPETITIONS} consultas): ${describeTimes(center)} (límite ${CENTER_LIMIT_MS} ms).`);
    console.log(`Contador de no leídos (${REPETITIONS} consultas): ${describeTimes(count)}.`);
    console.log(`Panel de control (${REPETITIONS} consultas): ${describeTimes(dashboard)} (límite ${DASHBOARD_LIMIT_MS} ms).`);

    const failures = [];
    if (Math.max(...center) >= CENTER_LIMIT_MS) failures.push('el centro tardó 2 segundos o más');
    if (Math.max(...dashboard) >= DASHBOARD_LIMIT_MS) failures.push('el panel tardó 3 segundos o más');
    if (failures.length > 0) {
      console.error(`FALLA: ${failures.join(' y ')}.`);
      process.exitCode = 1;
    } else {
      console.log('OK: el centro carga en menos de 2 segundos y el panel sigue por debajo de 3.');
    }
  } finally {
    if (!keep) {
      await truncateAll();
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main({ keep: process.argv.includes('--keep') });
  } catch (error) {
    console.error('Error al medir las notificaciones:', error.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
