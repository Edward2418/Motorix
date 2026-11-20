// Recorre por la API los escenarios del quickstart del Sprint 6 (T069) con los datos de ejemplo reales (seeds) y
// escribe un resultado por escenario. Los escenarios que dependen de ver la interfaz (4 en su parte visual y 16) no se
// pueden probar aquí y se informan como pendientes.
//
// Uso, desde `server/` y siempre contra la base de pruebas:
//   node --env-file=../.env.test scripts/validate-sprint6.js
//
// Se niega a ejecutarse si `DB_NAME` no es `motorix_test`: vacía las tablas, carga los seeds y las vuelve a vaciar.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import request from 'supertest';
import app from '../app.js';
import { pool, closePool } from '../config/db.js';
import { env } from '../config/env.js';
import { runSeeds } from './sqlRunner.js';
import { truncateAll } from './measure-dashboard.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Las contraseñas del estándar del MVP se leen de docs/project-context.md (no se escriben en el código).
async function standardPasswords() {
  const text = await readFile(path.join(root, 'docs/project-context.md'), 'utf8');
  const passwords = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\|\s*[^|]+\|\s*`([a-z0-9]+)`\s*\|\s*`([^`]+)`\s*\|$/);
    if (match) passwords[match[1]] = match[2];
  }
  return passwords;
}

const results = [];
function check(id, description, ok, detail = '') {
  results.push({ id, description, ok });
  console.log(`${ok ? 'OK    ' : 'FALLA '} Escenario ${id}: ${description}${detail ? ` (${detail})` : ''}`);
}

const dayOffset = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export async function main() {
  if (env.db.name !== 'motorix_test') {
    throw new Error(`Este script solo puede ejecutarse contra "motorix_test" (DB_NAME actual: "${env.db.name}").`);
  }
  await truncateAll();
  try {
    await runSeeds(pool, () => {});
    const passwords = await standardPasswords();
    const login = async (username) => {
      const res = await request(app).post('/api/auth/login').send({ identifier: username, password: passwords[username] });
      if (res.status !== 200) throw new Error(`No se pudo iniciar sesión con ${username} (${res.status}).`);
      return res.body.data.token;
    };
    const auth = (token) => ({ Authorization: `Bearer ${token}` });
    const get = (token, url) => request(app).get(url).set(auth(token));
    const center = async (token) => (await get(token, '/api/notifications')).body.data;
    const count = async (token) => (await get(token, '/api/notifications/count')).body.data.unread;
    const group = (data, type) => data.groups.find((g) => g.type === type);
    const types = (data) => data.groups.map((g) => g.type).sort();
    const markRead = (token, key) => request(app).post('/api/notifications/read').set(auth(token)).send({ key });

    const admin = await login('admin');
    const recepcion = await login('recepcion');
    const mecanico = await login('mecanico');
    const mecanico2 = await login('mecanico2');

    // 1 y 2: la campana y los grupos del administrador.
    const adminCenter = await center(admin);
    const allTypes = ['APPOINTMENT_TODAY', 'MAINTENANCE_OVERDUE', 'MAINTENANCE_SOON', 'ORDER_STALE', 'STOCK_LOW', 'STOCK_OUT'];
    check(1, 'el administrador ve el contador y hay avisos de los seis tipos', (await count(admin)) === adminCenter.unread && adminCenter.unread > 0 && types(adminCenter).join() === allTypes.join(), `unread ${adminCenter.unread}`);
    check(2, 'los avisos vienen agrupados por tipo', adminCenter.groups.every((g) => g.items.length > 0 && g.total >= g.items.length), types(adminCenter).join(', '));

    // 3: cifras iguales a las del panel, Mantenimientos e Inventario.
    const dashboard = (await get(admin, '/api/dashboard')).body.data;
    const overdue = (await get(admin, '/api/maintenance?status=PROGRAMADO&visualStatus=VENCIDO')).body.meta.total;
    const soon = (await get(admin, '/api/maintenance?status=PROGRAMADO&visualStatus=PROXIMO')).body.meta.total;
    const alerts = (await get(admin, '/api/parts/alerts')).body.data.length;
    const total = (type) => group(adminCenter, type)?.total ?? 0;
    check(3, 'los totales coinciden con el panel, Mantenimientos e Inventario',
      total('MAINTENANCE_OVERDUE') === dashboard.attention.maintenance.overdue && total('MAINTENANCE_OVERDUE') === overdue
      && total('MAINTENANCE_SOON') === dashboard.attention.maintenance.soon && total('MAINTENANCE_SOON') === soon
      && total('STOCK_LOW') + total('STOCK_OUT') === dashboard.indicators.lowStockParts && total('STOCK_LOW') + total('STOCK_OUT') === alerts,
      `vencidos ${overdue}, próximos ${soon}, stock ${alerts}`);

    // 4: el aviso de stock apunta a Inventario (la insignia y el aviso de inicio son parte visual).
    const stockItem = group(adminCenter, 'STOCK_LOW').items[0];
    check(4, 'el aviso de stock apunta a Inventario (la parte visual queda pendiente de Flutter)', stockItem.target.module === 'inventory');

    // 5 y 6: leído por usuario; el estado se conserva al volver a iniciar sesión.
    const maintItem = group(adminCenter, 'MAINTENANCE_SOON').items[0];
    const before = await count(admin);
    const marked = await markRead(admin, maintItem.key);
    const adminAgain = await login('admin');
    check(5, 'marcar como leído baja el contador en uno y se conserva al volver a entrar', marked.status === 200 && marked.body.data.unread === before - 1 && (await count(adminAgain)) === before - 1, `${before} → ${before - 1}`);
    const recItem = group(await center(recepcion), 'MAINTENANCE_SOON').items.find((a) => a.key === maintItem.key);
    check(6, 'para otra persona el mismo aviso sigue sin leer', recItem && recItem.read === false);

    // 7: un aviso leído que empeora (Próximo → Vencido) vuelve a aparecer sin leer.
    const maintId = Number(maintItem.key.split(':')[1]);
    await pool.query('UPDATE maintenance SET due_date = ? WHERE id = ?', [dayOffset(-2), maintId]);
    const worse = group(await center(admin), 'MAINTENANCE_OVERDUE').items.find((a) => a.key === maintItem.key);
    check(7, 'un mantenimiento leído que pasa a vencido vuelve a aparecer sin leer', worse && worse.read === false && worse.severity === 2);

    // 8: reponer el stock hace desaparecer el aviso; si vuelve a bajar, aparece sin leer.
    const stockId = Number(stockItem.key.split(':')[1]);
    await markRead(admin, stockItem.key);
    await pool.query('UPDATE parts SET stock = 1000 WHERE id = ?', [stockId]);
    const gone = !(await center(admin)).groups.flatMap((g) => g.items).some((a) => a.key === stockItem.key);
    await pool.query('UPDATE parts SET stock = 0 WHERE id = ?', [stockId]);
    const back = (await center(admin)).groups.flatMap((g) => g.items).find((a) => a.key === stockItem.key);
    check(8, 'al reponer el aviso desaparece y, si vuelve a bajar, aparece como no leído', gone && back && back.read === false);

    // 9 y 10: la recepción no ve stock; una orden detenida desaparece al avanzar de estado.
    const recCenter = await center(recepcion);
    check(9, 'la recepción ve mantenimientos, citas y órdenes detenidas, y no stock', types(recCenter).join() === ['APPOINTMENT_TODAY', 'MAINTENANCE_OVERDUE', 'MAINTENANCE_SOON', 'ORDER_STALE'].join(), types(recCenter).join(', '));
    const [[stale]] = await pool.query("SELECT id FROM service_orders WHERE folio = 'OS-2026-0011'");
    const hadStale = group(recCenter, 'ORDER_STALE').items.some((a) => a.key === `ORDER:${stale.id}`);
    const advance = await request(app).post(`/api/orders/${stale.id}/status`).set(auth(admin)).send({ status: 'EN_REPARACION' });
    const staleAfter = (await center(recepcion)).groups.flatMap((g) => g.items).some((a) => a.key === `ORDER:${stale.id}`);
    check(10, 'la orden detenida del seed aparece y desaparece al avanzar de estado', hadStale && advance.status === 200 && !staleAfter, `OS-2026-0011, avance ${advance.status}`);

    // 11 y 12: cada mecánico ve solo lo suyo y el servidor rechaza las rutas ajenas.
    await pool.query("UPDATE order_status_history SET changed_at = DATE_SUB(NOW(), INTERVAL 5 DAY) WHERE order_id = ?", [stale.id]);
    const [[mech1]] = await pool.query("SELECT id FROM users WHERE username = 'mecanico'");
    const c1 = await center(mecanico);
    const c2 = await center(mecanico2);
    const orders1 = c1.groups.flatMap((g) => g.items).map((a) => Number(a.key.split(':')[1]));
    const owners = (await pool.query('SELECT id, mechanic_id FROM service_orders WHERE id IN (?)', [orders1.length ? orders1 : [0]]))[0];
    check(11, 'cada mecánico ve solo avisos de órdenes suyas y ningún otro tipo', (c1.groups.length === 0 || types(c1).join() === 'ORDER_STALE') && (c2.groups.length === 0 || types(c2).join() === 'ORDER_STALE') && owners.every((o) => o.mechanic_id === mech1.id), `mecanico ${orders1.length} aviso(s), mecanico2 ${c2.unread}`);
    const forbidden = await get(mecanico, '/api/client-notices');
    const notFound = await markRead(mecanico, stockItem.key);
    check(12, 'el mecánico recibe 403 en clientes por avisar y 404 al marcar un aviso de stock', forbidden.status === 403 && notFound.status === 404 && notFound.body.error.code === 'NOTIFICATION_NOT_FOUND');

    // 13 a 15: clientes por avisar.
    const pending = (await get(recepcion, '/api/client-notices')).body;
    const reasons = [...new Set(pending.data.map((n) => n.reason))].sort();
    check(13, 'la lista trae los cuatro motivos con teléfono, vehículo y motivo', reasons.join() === 'CITA_MANANA,MANTENIMIENTO_PROXIMO,MANTENIMIENTO_VENCIDO,ORDEN_TERMINADA' && pending.data.every((n) => n.phone && n.vehicleLabel), reasons.join(', '));
    const target = pending.data.find((n) => n.reason === 'ORDEN_TERMINADA');
    const reg = await request(app).post('/api/client-notices').set(auth(recepcion)).send({ reason: target.reason, factKey: target.factKey, note: 'No contestó' });
    const after = (await get(recepcion, '/api/client-notices')).body;
    const dup = await request(app).post('/api/client-notices').set(auth(recepcion)).send({ reason: target.reason, factKey: target.factKey });
    check(14, 'se registra quién y cuándo, sale de la lista y no se repite (409)', reg.status === 201 && reg.body.data.notifiedByName && reg.body.data.notifiedAt && !after.data.some((n) => n.factKey === target.factKey) && dup.status === 409 && dup.body.error.code === 'NOTICE_ALREADY_REGISTERED', `${target.factKey} por ${reg.body.data?.notifiedByName}`);
    const [[client]] = await pool.query('SELECT client_id, vehicle_id, mechanic_id, created_by FROM service_orders WHERE id = ?', [Number(target.factKey.split(':')[1])]);
    await pool.query("UPDATE service_orders SET status = 'ENTREGADO', delivered_at = NOW() WHERE id = ?", [Number(target.factKey.split(':')[1])]);
    const [created] = await pool.query(
      "INSERT INTO service_orders (folio, client_id, vehicle_id, mechanic_id, entry_mileage, previous_mileage, reported_problem, status, created_by) VALUES ('OS-2026-0099', ?, ?, ?, 1000, 1000, 'Revisión posterior', 'TERMINADO', ?)",
      [client.client_id, client.vehicle_id, client.mechanic_id, client.created_by]
    );
    await pool.query("INSERT INTO order_status_history (order_id, from_status, to_status, changed_by) VALUES (?, 'EN_REPARACION', 'TERMINADO', ?)", [created.insertId, client.created_by]);
    const again = (await get(recepcion, '/api/client-notices')).body;
    check(15, 'una orden nueva del mismo cliente vuelve a aparecer por el hecho nuevo', again.data.some((n) => n.factKey === `ORDER:${created.insertId}`) && !again.data.some((n) => n.factKey === target.factKey));

    console.log('Escenario 16: pendiente. Requiere ver la interfaz (estados de carga, vacío y error); lo cubren las pruebas de Flutter escritas, aún sin ejecutar (H-07).');
    const failed = results.filter((r) => !r.ok);
    console.log(`\nResumen: ${results.length - failed.length} de ${results.length} escenarios por la API aprobados; 16 y la parte visual del 4 pendientes.`);
    if (failed.length > 0) process.exitCode = 1;
  } finally {
    await truncateAll();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    console.error('Error al validar el Sprint 6:', error.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
