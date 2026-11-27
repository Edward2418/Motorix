import { readFile } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import app from '../../app.js';
import { pool, resetTables, closePool, createUser, acceptTerms } from '../helpers/db.js';
import { bearer } from '../helpers/auth.js';
import { databaseDir, runSeeds, splitStatements } from '../../scripts/sqlRunner.js';
import { settingsService } from '../../services/settingsService.js';
import { signToken } from '../../utils/jwt.js';

afterAll(closePool);

const contar = async (tabla) => Number((await pool.query(`SELECT COUNT(*) AS total FROM ${tabla}`))[0][0].total);
const usuario = async (username) => (await pool.query('SELECT id, role FROM users WHERE username = ?', [username]))[0][0];
const tokenDe = ({ id, role }) => signToken({ sub: id, role });
// Los seeds ya no registran aceptaciones: quien vaya a usar la API acepta primero la versión vigente.
async function administrador() {
  const admin = await usuario('admin');
  await acceptTerms(admin.id);
  return admin;
}
const TABLAS = ['settings', 'service_types', 'terms_versions', 'terms_acceptances', 'audit_log'];

describe('datos de ejemplo del Sprint 7 (seed 012)', () => {
  beforeEach(async () => {
    await resetTables();
    await runSeeds(pool, () => {});
  });

  test('queda la configuración inicial, con los mismos valores que el servidor ya traía', async () => {
    expect(await contar('settings')).toBe(5);
    const vista = await settingsService.getView();
    expect(vista.workshop).toMatchObject({
      name: 'Taller Motorix (ejemplo)',
      address: 'Av. Principal 123, Ciudad de México',
      phone: '55 0000 0000',
      source: 'saved'
    });
    expect(vista.maintenance).toMatchObject({ soonDays: 30, soonKm: 1000, source: 'saved' });
  });

  test('hay al menos cinco tipos de servicio, cada uno con al menos un intervalo, y «Cambio de aceite» es de 180 días y 5,000 km', async () => {
    const [tipos] = await pool.query('SELECT name, interval_days, interval_km, active FROM service_types');
    expect(tipos.length).toBeGreaterThanOrEqual(5);
    for (const tipo of tipos) {
      expect({ nombre: tipo.name, conIntervalo: tipo.interval_days !== null || tipo.interval_km !== null }).toEqual({ nombre: tipo.name, conIntervalo: true });
      expect(tipo.active).toBe(1);
    }
    expect(tipos.find((t) => t.name === 'Cambio de aceite')).toMatchObject({ interval_days: 180, interval_km: 5000 });
  });

  test('las líneas de servicio que ya existían quedan enlazadas con su tipo y las demás siguen sin tipo', async () => {
    const [[enlazadas]] = await pool.query('SELECT COUNT(*) AS total FROM order_services WHERE service_type_id IS NOT NULL');
    expect(Number(enlazadas.total)).toBeGreaterThanOrEqual(5);
    const [[aceite]] = await pool.query(
      "SELECT t.name FROM order_services s JOIN service_types t ON t.id = s.service_type_id WHERE s.description = 'Cambio de aceite y filtros'"
    );
    expect(aceite.name).toBe('Cambio de aceite');
    const [[sinTipo]] = await pool.query("SELECT service_type_id FROM order_services WHERE description = 'Diagnóstico de suspensión'");
    expect(sinTipo.service_type_id).toBeNull();
  });

  test('no pisa el tipo de una línea que ya lo tenía', async () => {
    const [[otro]] = await pool.query("SELECT id FROM service_types WHERE name = 'Revisión de frenos'");
    await pool.query("UPDATE order_services SET service_type_id = ? WHERE description = 'Afinación mayor'", [otro.id]);

    await runSeeds(pool, () => {});

    const [[linea]] = await pool.query("SELECT service_type_id FROM order_services WHERE description = 'Afinación mayor'");
    expect(linea.service_type_id).toBe(otro.id);
  });

  test('la versión 1 de los términos está completa y ningún usuario sembrado la trae aceptada', async () => {
    const [[version]] = await pool.query('SELECT version, terms_text, privacy_text FROM terms_versions WHERE version = 1');
    expect(version.terms_text).toMatch(/^Términos y condiciones del servicio\./);
    expect(version.terms_text).toMatch(/antes de un uso real\.$/);
    expect(version.privacy_text).toMatch(/^Aviso de privacidad\./);
    expect(version.privacy_text).toMatch(/proyecto académico\.$/);
    expect(await contar('terms_acceptances')).toBe(0);
  });

  test('cada usuario, sembrado o nuevo, debe aceptar los términos antes de usar el sistema', async () => {
    const nuevo = await createUser({ username: 'usuario.nuevo', role: 'RECEPTIONIST' });
    const cuentas = [nuevo];
    for (const nombre of ['admin', 'recepcion', 'mecanico', 'mecanico2']) {
      cuentas.push(await usuario(nombre));
    }
    for (const cuenta of cuentas) {
      const antes = await request(app).get('/api/clients').set(bearer(tokenDe(cuenta)));
      expect({ id: cuenta.id, code: antes.body.error?.code }).toEqual({ id: cuenta.id, code: 'TERMS_NOT_ACCEPTED' });
      await acceptTerms(cuenta.id);
      expect((await request(app).get('/api/clients').set(bearer(tokenDe(cuenta)))).status).toBe(200);
    }
  });

  test('hay registros de bitácora de ejemplo de varias acciones, sin datos sensibles', async () => {
    const [filas] = await pool.query('SELECT action, detail FROM audit_log ORDER BY id');
    expect(filas.length).toBeGreaterThanOrEqual(4);
    expect(new Set(filas.map((f) => f.action)).size).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(filas)).not.toMatch(/\$2[aby]\$|eyJ|contraseña:|password/i);
  });

  test('el reporte de ingresos devuelve datos con los seeds', async () => {
    const admin = await administrador();
    const hoy = new Date();
    const desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 30);
    const iso = (f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;

    const res = await request(app).get(`/api/reports/income?from=${iso(desde)}&to=${iso(hoy)}`).set(bearer(tokenDe(admin)));

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBeGreaterThan(0);
    expect(res.body.data.paymentsCount).toBeGreaterThan(0);
    expect(res.body.data.byMethod.length).toBeGreaterThanOrEqual(2);
  });

  test('las propuestas y los tickets nuevos usan los tipos sembrados', async () => {
    const admin = await administrador();
    const [[orden]] = await pool.query("SELECT id FROM service_orders WHERE folio = 'OS-2026-0009'");

    const res = await request(app).get(`/api/orders/${orden.id}/maintenance-suggestion`).set(bearer(tokenDe(admin)));

    expect(res.status).toBe(200);
    expect(res.body.data.map((s) => s.serviceTypeName)).toContain('Cambio de aceite');
  });

  test('repetir los seeds no duplica nada', async () => {
    const antes = {};
    for (const tabla of TABLAS) {
      antes[tabla] = await contar(tabla);
    }
    const [[ligadas]] = await pool.query('SELECT COUNT(*) AS total FROM order_services WHERE service_type_id IS NOT NULL');

    await runSeeds(pool, () => {});
    await runSeeds(pool, () => {});

    for (const tabla of TABLAS) {
      expect({ tabla, total: await contar(tabla) }).toEqual({ tabla, total: antes[tabla] });
    }
    const [[despuesLigadas]] = await pool.query('SELECT COUNT(*) AS total FROM order_services WHERE service_type_id IS NOT NULL');
    expect(despuesLigadas.total).toBe(ligadas.total);
  });
});

describe('el archivo del seed 012', () => {
  const ruta = path.join(databaseDir, 'seeds', '012_sample_sprint7.sql');

  test('ningún texto lleva punto y coma: el ejecutor corta en cada uno y el seed se cargaría incompleto', async () => {
    const sql = await readFile(ruta, 'utf8');
    const sinComentarios = sql.split(/\r?\n/).filter((linea) => !linea.trim().startsWith('--')).join('\n');
    const sentencias = splitStatements(sql);

    // Hay una sentencia por cada punto y coma que cierra una sentencia: ninguno quedó dentro de un texto.
    expect(sinComentarios.split(';').filter((t) => t.trim().length > 0)).toHaveLength(sentencias.length);
    expect(sentencias).toHaveLength(5);
    for (const sentencia of sentencias) {
      expect({ inicio: sentencia.slice(0, 12), valida: /^(INSERT INTO|UPDATE )/.test(sentencia) }).toEqual({ inicio: sentencia.slice(0, 12), valida: true });
    }
  });

  test('ninguna línea de un texto empieza con dos guiones (el ejecutor la descartaría como comentario)', async () => {
    const sql = await readFile(ruta, 'utf8');
    const intencionales = sql.split(/\r?\n/).filter((linea) => linea.trim().startsWith('--'));
    expect(intencionales.every((linea) => /^--\s/.test(linea.trim()) || linea.trim() === '--')).toBe(true);
  });
});
