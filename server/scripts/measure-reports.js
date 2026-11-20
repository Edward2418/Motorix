// Mide los reportes del Sprint 7 con datos de carga (SC-003): 2 000 órdenes, 5 000 movimientos de inventario, pagos y
// tickets sintéticos, los mismos de `measure-dashboard.js`. Mide el reporte de ingresos (día, semana, mes y el máximo de
// 366 días), su exportación a CSV, el panel de control y el centro de avisos, y el costo del filtro de términos que ahora
// ejecuta `authenticate` en cada petición. Falla (código de salida 1) si algún reporte, el panel o la exportación tardan
// 3 segundos o más, o el centro de avisos 2 segundos o más.
//
// Uso, desde `server/` y siempre contra la base de pruebas:
//   node --env-file=../.env.test scripts/measure-reports.js [--keep]
//
// Se niega a ejecutarse si `DB_NAME` no es `motorix_test`: vacía las tablas antes de cargar los datos.
import { pathToFileURL } from 'node:url';
import { pool, closePool } from '../config/db.js';
import { env } from '../config/env.js';
import { getDashboard } from '../services/dashboardService.js';
import { notificationService } from '../services/notificationService.js';
import { income, incomeToCsv } from '../services/reportService.js';
import { dayEnd, dayStart } from '../services/reportRules.js';
import { hasAcceptedCurrent } from '../services/termsService.js';
import { describeTimes, loadData, refreshStatistics, truncateAll } from './measure-dashboard.js';

const REPORT_LIMIT_MS = 3000;
const CENTER_LIMIT_MS = 2000;
const REPETITIONS = 5;

const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

async function timeIt(action, repetitions = REPETITIONS) {
  const times = [];
  for (let i = 0; i < repetitions; i += 1) {
    const start = process.hrtime.bigint();
    await action();
    times.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  return times;
}

// Una versión de los términos aceptada por el administrador de carga: así el filtro de `authenticate` hace su consulta
// completa (con una versión publicada y una aceptación que buscar) y no la rama corta de «sin versión».
async function loadTerms() {
  const [[admin]] = await pool.query("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1");
  const [result] = await pool.query("INSERT INTO terms_versions (version, terms_text, privacy_text) VALUES (1, 'Términos de carga.', 'Aviso de carga.')");
  await pool.query('INSERT INTO terms_acceptances (user_id, terms_version_id) VALUES (?, ?)', [admin.id, result.insertId]);
  return admin;
}

export async function main({ keep = false } = {}) {
  if (env.db.name !== 'motorix_test') {
    throw new Error(`Este script solo puede ejecutarse contra "motorix_test" (DB_NAME actual: "${env.db.name}").`);
  }
  await truncateAll();
  try {
    const loaded = await loadData();
    const admin = await loadTerms();
    console.log(`Datos de carga: ${loaded.orders} órdenes, ${loaded.movements} movimientos de inventario, ${loaded.payments} pagos y ${loaded.tickets} tickets.`);
    await refreshStatistics();
    await pool.query('ANALYZE TABLE terms_acceptances');

    const hoy = new Date();
    const ranges = {
      'ingresos de hoy': [iso(hoy), iso(hoy)],
      'ingresos de la semana': [iso(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 6)), iso(hoy)],
      'ingresos del mes': [iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), iso(hoy)],
      'ingresos de 366 días': [iso(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 365)), iso(hoy)]
    };

    const results = {};
    for (const [name, [from, to]] of Object.entries(ranges)) {
      results[name] = await timeIt(() => income({ from, to, start: dayStart(from), end: dayEnd(to) }));
      const sample = await income({ from, to, start: dayStart(from), end: dayEnd(to) });
      console.log(`${name} (${sample.paymentsCount} pagos, ${sample.byDay.length} días): ${describeTimes(results[name])} (límite ${REPORT_LIMIT_MS} ms).`);
    }
    const [from, to] = ranges['ingresos de 366 días'];
    const range = { from, to, start: dayStart(from), end: dayEnd(to) };
    results['exportación a CSV (366 días)'] = await timeIt(async () => incomeToCsv(await income(range)));
    console.log(`Exportación a CSV de 366 días: ${describeTimes(results['exportación a CSV (366 días)'])} (límite ${REPORT_LIMIT_MS} ms).`);

    results['panel de control'] = await timeIt(() => getDashboard('month'));
    console.log(`Panel de control: ${describeTimes(results['panel de control'])} (límite ${REPORT_LIMIT_MS} ms).`);
    const center = await timeIt(() => notificationService.getCenter({ id: admin.id, role: 'ADMIN' }));
    console.log(`Centro de avisos: ${describeTimes(center)} (límite ${CENTER_LIMIT_MS} ms).`);

    // El filtro de términos corre en cada petición autenticada: aquí se mide solo y 50 veces, para ver su costo real.
    const filter = await timeIt(() => hasAcceptedCurrent(admin.id), 50);
    console.log(`Filtro de términos de authenticate (50 consultas): ${describeTimes(filter)}.`);

    const failures = Object.entries(results).filter(([, times]) => Math.max(...times) >= REPORT_LIMIT_MS).map(([name]) => name);
    if (Math.max(...center) >= CENTER_LIMIT_MS) failures.push('centro de avisos');
    if (failures.length > 0) {
      console.error(`FALLA: tardaron más de lo permitido: ${failures.join(', ')}.`);
      process.exitCode = 1;
    } else {
      console.log('OK: los reportes y la exportación cargan en menos de 3 segundos, el centro de avisos en menos de 2, y el filtro de términos no los degrada.');
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
    console.error('Error al medir los reportes:', error.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
