// Recorre por la API los escenarios del quickstart del Sprint 7 (etapas 1 y 2, escenarios 1 a 26) con los datos de ejemplo
// reales (seeds) y escribe un resultado por escenario. Los pasos que dependen de ver la interfaz (rechazar los términos,
// el cierre a los 30 minutos y abrir el CSV en una hoja de cálculo) no se pueden probar aquí: se informan aparte con la
// prueba automática que los cubre.
//
// Uso, desde `server/` y siempre contra la base de pruebas:
//   node --env-file=../.env.test scripts/validate-sprint7.js
//
// Se niega a ejecutarse si `DB_NAME` no es `motorix_test`: vacía las tablas, carga los seeds y las vuelve a vaciar.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import request from 'supertest';
import app from '../app.js';
import { pool, closePool } from '../config/db.js';
import { env } from '../config/env.js';
import { runSeeds } from './sqlRunner.js';
import { truncateAll } from './measure-dashboard.js';
import { publishTerms } from './publish-terms.js';

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

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const NEW_PASSWORD = 'Validacion2026';

export async function main() {
  if (env.db.name !== 'motorix_test') {
    throw new Error(`Este script solo puede ejecutarse contra "motorix_test" (DB_NAME actual: "${env.db.name}").`);
  }
  await truncateAll();
  const carpeta = await mkdtemp(path.join(os.tmpdir(), 'motorix-validacion-'));
  try {
    await runSeeds(pool, () => {});
    const passwords = await standardPasswords();
    const login = (identifier, password) => request(app).post('/api/auth/login').send({ identifier, password });
    const token = async (username) => {
      const res = await login(username, passwords[username]);
      if (res.status !== 200) throw new Error(`No se pudo iniciar sesión con ${username} (${res.status}).`);
      return res.body.data.token;
    };
    const auth = (t) => ({ Authorization: `Bearer ${t}` });
    const get = (t, url) => request(app).get(url).set(auth(t));
    const post = (t, url, body = {}) => request(app).post(url).set(auth(t)).send(body);
    const put = (t, url, body = {}) => request(app).put(url).set(auth(t)).send(body);
    const patch = (t, url, body = {}) => request(app).patch(url).set(auth(t)).send(body);
    const audit = async (t, consulta = '') => (await get(t, `/api/audit-log?pageSize=200${consulta}`)).body.data;

    const admin = await token('admin');
    const recepcion = await token('recepcion');
    const mecanico = await token('mecanico');

    // ------------------------------------------------------------------ Etapa 1
    // 1 a 3: configuración.
    const cambio = await put(admin, '/api/settings', { workshop: { name: 'Taller Los Pinos', phone: '55 1111 2222' } });
    const leida = (await get(admin, '/api/settings')).body.data;
    check(1, 'se guarda el nombre y el teléfono sin reiniciar y la pantalla los muestra', cambio.status === 200 && leida.workshop.name === 'Taller Los Pinos' && leida.workshop.phone === '55 1111 2222' && leida.workshop.source === 'saved');

    const [[orden9]] = await pool.query("SELECT id FROM service_orders WHERE folio = 'OS-2026-0009'");
    const [[orden10]] = await pool.query("SELECT id FROM service_orders WHERE folio = 'OS-2026-0010'");
    const ticketNuevo = await post(recepcion, `/api/orders/${orden9.id}/ticket`);
    const ticketViejo = await get(recepcion, `/api/orders/${orden10.id}/ticket`);
    check(2, 'el ticket nuevo trae los datos nuevos del taller y el emitido antes conserva los suyos', ticketNuevo.status === 201 && ticketNuevo.body.data.workshop.name === 'Taller Los Pinos' && ticketViejo.body.data.workshop.name === 'Taller Motorix (ejemplo)', `${ticketViejo.body.data.workshop.name}`);

    const invalido = await put(admin, '/api/settings', { workshop: { name: '' }, maintenance: { soonDays: 0 } });
    const intacta = (await get(admin, '/api/settings')).body.data;
    const campos = (invalido.body.error?.details ?? []).map((d) => d.field).sort();
    check(3, 'un nombre vacío y un margen de 0 días dan un mensaje por campo y no guardan nada', invalido.status === 400 && campos.join() === 'maintenance.soonDays,workshop.name' && intacta.workshop.name === 'Taller Los Pinos', campos.join(', '));

    // 4: el margen de «Próximo» cambia la lista, el panel y los avisos juntos.
    const proximos = async () => ((await get(admin, '/api/maintenance?status=PROGRAMADO&pageSize=100')).body.data).filter((m) => m.visualStatus === 'PROXIMO');
    const avisosProximos = async () => ((await get(admin, '/api/notifications')).body.data.groups.find((g) => g.type === 'MAINTENANCE_SOON')?.total ?? 0);
    const antesLista = (await proximos()).length;
    const antesAvisos = await avisosProximos();
    await put(admin, '/api/settings', { maintenance: { soonDays: 1, soonKm: 100 } });
    const despuesLista = (await proximos()).length;
    const despuesAvisos = await avisosProximos();
    check(4, 'bajar el margen a 1 día y 100 km reduce los «Próximo» en la lista y en los avisos a la vez', antesLista > 0 && despuesLista < antesLista && despuesAvisos < antesAvisos && antesLista - despuesLista === antesAvisos - despuesAvisos, `lista ${antesLista}→${despuesLista}, avisos ${antesAvisos}→${despuesAvisos}`);
    await put(admin, '/api/settings', { maintenance: { soonDays: 30, soonKm: 1000 } });

    // 5: instalación sin configuración guardada.
    await pool.query('DELETE FROM settings');
    const base = (await get(admin, '/api/settings')).body.data;
    check(5, 'sin configuración guardada rigen los valores del servidor o 30 días y 1,000 km, sin fallar', base.maintenance.soonDays === 30 && base.maintenance.soonKm === 1000 && base.workshop.source !== 'saved', `${base.maintenance.source}`);

    // 6, 8 y 9: usuario nuevo y términos.
    const alta = await post(admin, '/api/users', { username: 'validacion', name: 'Persona de validación', email: 'validacion@motorix.local', password: NEW_PASSWORD, role: 'RECEPTIONIST' });
    const sesion = await login('validacion', NEW_PASSWORD);
    const nuevo = sesion.body.data.token;
    check(6, 'un usuario nuevo inicia sesión y el servidor indica termsAccepted false (la pantalla de términos se ve en la interfaz)', alta.status === 201 && sesion.body.data.termsAccepted === false);
    console.log('Escenario 7: rechazar los términos cierra la sesión en el cliente; lo cubre terms_screen_test.dart.');

    const bloqueo = await get(nuevo, '/api/clients');
    const vigente = await get(nuevo, '/api/terms/current');
    check(9, 'sin aceptar, una ruta protegida responde 403 TERMS_NOT_ACCEPTED y solo funcionan ver y aceptar', bloqueo.status === 403 && bloqueo.body.error.code === 'TERMS_NOT_ACCEPTED' && vigente.status === 200 && vigente.body.data.accepted === false);

    const acepta = await post(nuevo, '/api/terms/accept', { version: vigente.body.data.version });
    const reingreso = await login('validacion', NEW_PASSWORD);
    const [[registro]] = await pool.query("SELECT COUNT(*) AS total FROM terms_acceptances a JOIN users u ON u.id = a.user_id WHERE u.username = 'validacion'");
    check(8, 'aceptar los términos deja el registro (quién, versión y fecha) y al volver a entrar no se piden', acepta.status === 200 && reingreso.body.data.termsAccepted === true && Number(registro.total) === 1 && (await get(nuevo, '/api/clients')).status === 200);

    // 11: lista de aceptaciones.
    const aceptaciones = await get(admin, '/api/terms/acceptances?pageSize=50');
    check(11, 'la lista de aceptaciones muestra usuario, versión y fecha', aceptaciones.status === 200 && aceptaciones.body.data.length >= 5 && aceptaciones.body.data.every((a) => a.username && a.version && a.acceptedAt), `${aceptaciones.body.meta.total} aceptaciones`);

    // 12 y 13: bitácora.
    const [[usuarioNuevo]] = await pool.query("SELECT id FROM users WHERE username = 'validacion'");
    const [[pieza]] = await pool.query("SELECT id, sale_price FROM parts WHERE code = 'BUJ-NGK-01'");
    const [[pagoPendiente]] = await pool.query("SELECT id FROM payments WHERE status = 'PENDIENTE' ORDER BY id LIMIT 1");
    await put(admin, `/api/users/${usuarioNuevo.id}`, { name: 'Persona de validación', email: 'validacion@motorix.local', role: 'MECHANIC' });
    await put(admin, `/api/parts/${pieza.id}`, { salePrice: Number(pieza.sale_price) + 10 });
    await put(admin, '/api/settings', { workshop: { address: 'Calle Nueva 45, Ciudad de México' } });
    const cancelado = await post(admin, `/api/payments/${pagoPendiente.id}/cancel`, { reason: 'Validación del quickstart' });
    const bitacora = await audit(admin);
    const acciones = new Set(bitacora.map((r) => r.action));
    const texto = JSON.stringify(bitacora);
    check(12, 'la bitácora registra cambio de rol, de precio, de configuración y pago cancelado, con quién y cuándo, sin secretos', cancelado.status === 200 && ['USER_ROLE_CHANGED', 'PART_PRICE_CHANGED', 'SETTINGS_CHANGED', 'PAYMENT_CANCELLED'].every((a) => acciones.has(a)) && bitacora.every((r) => r.createdAt) && !/\$2[aby]\$|eyJ|Validacion2026|Validación del quickstart/.test(texto), `${bitacora.length} registros`);

    const filtrada = await audit(admin, '&action=USER_ROLE_CHANGED');
    const rutas = await Promise.all(['put', 'patch', 'delete'].map((m) => request(app)[m]('/api/audit-log/1').set(auth(admin)).send({})));
    check(13, 'la bitácora se filtra por acción y PUT, PATCH y DELETE responden 404', filtrada.length >= 1 && filtrada.every((r) => r.action === 'USER_ROLE_CHANGED') && rutas.every((r) => r.status === 404));

    // 14: fallos de inicio de sesión.
    for (let i = 0; i < 5; i += 1) await login('validacion', 'Incorrecta1');
    const sexto = await login('validacion', 'Incorrecta1');
    for (let i = 0; i < 2; i += 1) await login('texto-que-parece-una-clave-9X', 'Incorrecta1');
    const [[fallos]] = await pool.query("SELECT COUNT(*) AS total FROM audit_log WHERE action = 'LOGIN_FAILED' AND actor = 'validacion'");
    const [[bloqueos]] = await pool.query("SELECT COUNT(*) AS total FROM audit_log WHERE action = 'ACCOUNT_LOCKED' AND actor = 'validacion'");
    const [[guardado]] = await pool.query("SELECT COUNT(*) AS total FROM audit_log WHERE detail LIKE '%9X%' OR actor LIKE '%9X%'");
    check(14, 'quedan los 5 fallos y el bloqueo en la bitácora y con una cuenta inexistente no se guarda el texto escrito', sexto.status === 429 && Number(fallos.total) === 5 && Number(bloqueos.total) === 1 && Number(guardado.total) === 0);

    // 15: contraseñas débiles.
    const debil = await post(admin, '/api/users', { username: 'debil', name: 'Débil', email: 'debil@motorix.local', password: 'abc', role: 'RECEPTIONIST' });
    check(15, 'una contraseña débil se rechaza con un mensaje que dice qué falta', debil.status === 400 && debil.body.error.details.some((d) => d.field === 'password'), debil.body.error.details.map((d) => d.message).join(' '));
    console.log('Escenario 16: el cierre a los 30 minutos es del cliente; lo cubre inactivity_guard_test.dart (con tiempo simulado).');

    // 17 y 18: exposición e inyección.
    const rutasLectura = ['/api/users', '/api/parts', '/api/orders', `/api/orders/${orden9.id}`, `/api/orders/${orden9.id}/payments`, `/api/orders/${orden9.id}/ticket`];
    let filtracion = false;
    for (const t of [admin, recepcion]) {
      for (const url of rutasLectura) {
        const cuerpo = JSON.stringify((await get(t, url)).body);
        if (/password_hash|passwordHash|\$2[aby]\$|eyJ[A-Za-z0-9_-]{10,}\./.test(cuerpo)) filtracion = true;
      }
    }
    const piezasRecepcion = JSON.stringify((await get(mecanico, '/api/parts')).body);
    check(17, 'ninguna respuesta de usuarios, refacciones, órdenes, pagos y tickets lleva hash ni token, y el mecánico no ve precios de compra', !filtracion && !/purchasePrice/.test(piezasRecepcion));
    const inyeccion = encodeURIComponent("' OR 1=1 --");
    const buscadas = await Promise.all(['clients?search', 'vehicles?search', 'orders?search', 'users?search', 'parts?q'].map((r) => get(admin, `/api/${r}=${inyeccion}`)));
    const [[tablaUsuarios]] = await pool.query('SELECT COUNT(*) AS total FROM users');
    check(18, "escribir ' OR 1=1 -- en las búsquedas se trata como texto, sin error ni cambios", buscadas.every((r) => r.status === 200 && (r.body.meta?.total ?? r.body.data.length) === 0) && Number(tablaUsuarios.total) >= 4);

    // 19: permisos.
    const prohibidas = ['/api/settings', '/api/audit-log', '/api/terms/acceptances', '/api/reports/income?from=2026-10-01&to=2026-10-31'];
    const rechazos = [];
    for (const t of [recepcion, mecanico]) for (const url of prohibidas) rechazos.push((await get(t, url)).status);
    check(19, 'recepción y mecánico reciben 403 en configuración, bitácora, aceptaciones y reportes', rechazos.every((s) => s === 403), `${rechazos.length} llamadas`);

    // ------------------------------------------------------------------ Etapa 2
    // 20 y 21: catálogo.
    const nuevoTipo = await post(admin, '/api/service-types', { name: 'Cambio de filtro de aire', intervalDays: 365, intervalKm: 15000 });
    const repetido = await post(admin, '/api/service-types', { name: 'CAMBIO DE FILTRO DE AIRE', intervalDays: 30 });
    check(20, 'se crea un tipo y un nombre repetido responde SERVICE_TYPE_DUPLICATE', nuevoTipo.status === 201 && repetido.status === 409 && repetido.body.error.code === 'SERVICE_TYPE_DUPLICATE');

    const [[aceite]] = await pool.query("SELECT id FROM service_types WHERE name = 'Cambio de aceite'");
    await patch(admin, `/api/service-types/${aceite.id}/status`, { active: false });
    const activos = (await get(recepcion, '/api/service-types?active=true')).body.data;
    const borrar = await request(app).delete(`/api/service-types/${aceite.id}`).set(auth(admin));
    const [[conserva]] = await pool.query("SELECT COUNT(*) AS total FROM order_services WHERE service_type_id = ?", [aceite.id]);
    const [[ordenAbierta]] = await pool.query("SELECT id FROM service_orders WHERE status = 'DIAGNOSTICO' ORDER BY id LIMIT 1");
    const rechazado = await post(admin, `/api/orders/${ordenAbierta.id}/services`, { description: 'Aceite', amount: 100, serviceTypeId: aceite.id });
    check(21, 'un tipo desactivado no se ofrece ni se acepta en órdenes nuevas, las anteriores lo conservan y no se puede borrar', !activos.some((t) => t.id === aceite.id) && rechazado.status === 400 && Number(conserva.total) >= 1 && borrar.status === 404);
    await patch(admin, `/api/service-types/${aceite.id}/status`, { active: true });

    // 22: línea con tipo y propuesta.
    const [[mecDeOrden]] = await pool.query('SELECT mechanic_id FROM service_orders WHERE id = ?', [ordenAbierta.id]);
    const [[usuarioMecanico]] = await pool.query('SELECT username FROM users WHERE id = ?', [mecDeOrden.mechanic_id]);
    const tokenMecanico = await token(usuarioMecanico.username);
    const conTipo = await post(tokenMecanico, `/api/orders/${ordenAbierta.id}/services`, { description: 'Aceite y filtro', amount: 600, serviceTypeId: aceite.id });
    const sinTipo = await post(tokenMecanico, `/api/orders/${ordenAbierta.id}/services`, { description: 'Revisión visual', amount: 100 });
    const propuesta = await get(tokenMecanico, `/api/orders/${ordenAbierta.id}/maintenance-suggestion`);
    check(22, 'la línea con tipo funciona, la propuesta trae fecha y kilometraje y una línea sin tipo sigue como antes', conTipo.status === 201 && sinTipo.status === 201 && propuesta.status === 200 && propuesta.body.data.some((s) => s.serviceTypeName === 'Cambio de aceite' && s.dueDate && s.dueMileage > 0), `${propuesta.body.data.length} propuesta(s)`);

    // 23: ticket con y sin tipo, y no cambia.
    // Un vehículo sin orden abierta (el índice único permite una sola por vehículo) y los datos de la orden 9 para el resto.
    const [[referencia]] = await pool.query('SELECT mechanic_id, created_by FROM service_orders WHERE id = ?', [orden9.id]);
    const [[libre]] = await pool.query("SELECT v.id AS vehicle_id, v.client_id FROM vehicles v WHERE v.active = 1 AND NOT EXISTS (SELECT 1 FROM service_orders o WHERE o.vehicle_id = v.id AND o.status NOT IN ('ENTREGADO','CANCELADA')) ORDER BY v.id LIMIT 1");
    const vehiculo = { ...referencia, ...libre };
    const [creada] = await pool.query(
      "INSERT INTO service_orders (folio, client_id, vehicle_id, mechanic_id, entry_mileage, previous_mileage, reported_problem, status, created_by) VALUES ('OS-2026-0098', ?, ?, ?, 1000, 1000, 'Revisión sin tipo', 'TERMINADO', ?)",
      [vehiculo.client_id, vehiculo.vehicle_id, vehiculo.mechanic_id, vehiculo.created_by]
    );
    await pool.query("INSERT INTO order_services (order_id, description, cost) VALUES (?, 'Diagnóstico general', 300)", [creada.insertId]);
    const sinTipoTicket = await post(recepcion, `/api/orders/${creada.insertId}/ticket`);
    const antes = ticketNuevo.body.data.nextService;
    await put(admin, `/api/service-types/${aceite.id}`, { name: 'Cambio de aceite', intervalDays: 30, intervalKm: 500 });
    const despues = (await get(recepcion, `/api/orders/${orden9.id}/ticket`)).body.data.nextService;
    check(23, 'el ticket con tipo trae «Próximo servicio», el de otra orden sin tipo no, y el emitido no cambia al editar el tipo', !!antes && !('nextService' in sinTipoTicket.body.data) && JSON.stringify(antes) === JSON.stringify(despues), `${JSON.stringify(antes)}`);

    // 24 a 26: reportes.
    const hoy = new Date();
    const primero = iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    const desde30 = iso(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 30));
    const reporte = (await get(admin, `/api/reports/income?from=${desde30}&to=${iso(hoy)}`)).body.data;
    const [[directo]] = await pool.query(
      "SELECT ROUND(SUM(amount) * 100) AS centavos, COUNT(*) AS total FROM payments WHERE status = 'PAGADO' AND paid_at >= ? AND paid_at <= ?",
      [new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 30, 0, 0, 0), new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59, 999)]
    );
    check(24, 'el total y los desgloses de ingresos coinciden centavo por centavo con los pagos', Math.round(reporte.total * 100) === Number(directo.centavos) && reporte.paymentsCount === Number(directo.total) && Math.round(reporte.byMethod.reduce((s, m) => s + m.total * 100, 0)) === Number(directo.centavos) && Math.round(reporte.byDay.reduce((s, d) => s + d.total * 100, 0)) === Number(directo.centavos), `$${reporte.total} en ${reporte.paymentsCount} pagos desde ${primero.slice(0, 4)}`);

    const vacio = (await get(admin, '/api/reports/income?from=2020-01-01&to=2020-01-31')).body.data;
    const invertido = await get(admin, '/api/reports/income?from=2026-10-31&to=2026-10-01');
    const largo = await get(admin, '/api/reports/income?from=2025-01-01&to=2026-01-02');
    check(25, 'un rango sin pagos da cero, y el invertido y el de más de 366 días responden REPORT_RANGE_INVALID', vacio.total === 0 && vacio.paymentsCount === 0 && invertido.status === 400 && invertido.body.error.code === 'REPORT_RANGE_INVALID' && largo.status === 400 && largo.body.error.code === 'REPORT_RANGE_INVALID');

    const csv = await request(app).get(`/api/reports/income?from=${desde30}&to=${iso(hoy)}&format=csv`).set(auth(admin)).buffer(true).parse((res, cb) => { const t = []; res.on('data', (c) => t.push(c)); res.on('end', () => cb(null, Buffer.concat(t).toString('utf8'))); });
    const lineas = csv.body.replace('﻿', '').trim().split('\r\n');
    const csvVacio = await request(app).get('/api/reports/income?from=2020-01-01&to=2020-01-31&format=csv').set(auth(admin)).buffer(true).parse((res, cb) => { const t = []; res.on('data', (c) => t.push(c)); res.on('end', () => cb(null, Buffer.concat(t).toString('utf8'))); });
    check(26, 'el CSV tiene BOM, encabezados y el mismo total que la pantalla; sin pagos trae encabezados y total en cero', csv.body.startsWith('﻿') && lineas[0] === 'Sección,Concepto,Pagos,Total' && lineas.at(-1) === `Total,,${reporte.paymentsCount},${reporte.total.toFixed(2)}` && csvVacio.body.replace('﻿', '').trim() === 'Sección,Concepto,Pagos,Total\r\nTotal,,0,0.00', `${lineas.length - 2} filas`);

    // 10 (al final: publicar una versión nueva bloquea a todos hasta que la acepten).
    const archivo = path.join(carpeta, 'terminos-v2.txt');
    await writeFile(archivo, 'Términos de la versión 2, con cambios.\n=== AVISO DE PRIVACIDAD ===\nAviso de privacidad de la versión 2.', 'utf8');
    const publicada = await publishTerms({ file: archivo });
    const bloqueadoV2 = await get(admin, '/api/clients');
    const pideV2 = await get(admin, '/api/terms/current');
    check(10, 'al publicar la versión 2 quien aceptó la 1 vuelve a ver los términos (403 hasta aceptar)', publicada.version === 2 && bloqueadoV2.status === 403 && bloqueadoV2.body.error.code === 'TERMS_NOT_ACCEPTED' && pideV2.body.data.version === 2 && pideV2.body.data.accepted === false);
    await post(admin, '/api/terms/accept', { version: 2 });
    check('10b', 'tras aceptar la versión 2 el administrador vuelve a usar el sistema', (await get(admin, '/api/clients')).status === 200);

    console.log('Escenarios de la etapa 3 (27 y 28): no se construyeron; quedan registrados como trabajo futuro (FR-032).');
    const failed = results.filter((r) => !r.ok);
    console.log(`\nResumen: ${results.length - failed.length} de ${results.length} comprobaciones por la API aprobadas; 16, el rechazo de los términos (7, parte visual) y abrir el CSV en una hoja de cálculo se verifican con las pruebas del cliente y a mano.`);
    if (failed.length > 0) process.exitCode = 1;
  } finally {
    await rm(carpeta, { recursive: true, force: true });
    await truncateAll();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    console.error('Error al validar el Sprint 7:', error.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
