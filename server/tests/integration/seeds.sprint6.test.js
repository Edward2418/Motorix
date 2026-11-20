import { pool, resetTables, closePool } from '../helpers/db.js';
import { runSeeds } from '../../scripts/sqlRunner.js';
import { notificationService } from '../../services/notificationService.js';
import { listPending } from '../../services/clientNoticeService.js';

afterAll(closePool);

const count = async (table) => (await pool.query(`SELECT COUNT(*) AS total FROM ${table}`))[0][0].total;
const usuario = async (username) => (await pool.query('SELECT id, role FROM users WHERE username = ?', [username]))[0][0];
const tipos = (centro) => centro.groups.map((g) => g.type).sort();

describe('datos de ejemplo del Sprint 6 (seed 011)', () => {
  beforeEach(async () => {
    await resetTables();
    await runSeeds(pool, () => {});
  });

  test('el administrador ve al menos un aviso de cada uno de los seis tipos', async () => {
    const admin = await usuario('admin');

    const centro = await notificationService.getCenter(admin);

    expect(tipos(centro)).toEqual(
      ['APPOINTMENT_TODAY', 'MAINTENANCE_OVERDUE', 'MAINTENANCE_SOON', 'ORDER_STALE', 'STOCK_LOW', 'STOCK_OUT'].sort()
    );
    for (const grupo of centro.groups) {
      expect({ tipo: grupo.type, total: grupo.total > 0 }).toEqual({ tipo: grupo.type, total: true });
    }
  });

  test('el mecánico del seed recibe una orden detenida suya y ningún otro tipo de aviso', async () => {
    const mecanico = await usuario('mecanico');

    const centro = await notificationService.getCenter(mecanico);

    expect(tipos(centro)).toEqual(['ORDER_STALE']);
    expect(centro.groups[0].total).toBeGreaterThanOrEqual(1);
    const [[dueno]] = await pool.query(
      `SELECT mechanic_id FROM service_orders WHERE id = ?`,
      [centro.groups[0].items[0].target.id]
    );
    expect(dueno.mechanic_id).toBe(mecanico.id);
  });

  test('la recepción ve mantenimientos, citas y órdenes detenidas, y ningún aviso de stock', async () => {
    const recepcion = await usuario('recepcion');

    const centro = await notificationService.getCenter(recepcion);

    expect(tipos(centro)).toEqual(['APPOINTMENT_TODAY', 'MAINTENANCE_OVERDUE', 'MAINTENANCE_SOON', 'ORDER_STALE']);
  });

  test('hay al menos un hecho de cliente por avisar de cada motivo', async () => {
    const pendientes = await listPending();

    const motivos = new Set(pendientes.map((n) => n.reason));

    expect([...motivos].sort()).toEqual(['CITA_MANANA', 'MANTENIMIENTO_PROXIMO', 'MANTENIMIENTO_VENCIDO', 'ORDEN_TERMINADA']);
  });

  test('hay un registro de aviso a cliente y ese hecho ya no aparece como pendiente', async () => {
    expect(await count('client_notices')).toBe(1);
    const [[aviso]] = await pool.query('SELECT reason, fact_key, note FROM client_notices');
    expect(aviso.reason).toBe('ORDEN_TERMINADA');
    expect(aviso.note).toBeTruthy();

    const pendientes = await listPending();

    expect(pendientes.map((n) => n.factKey)).not.toContain(aviso.fact_key);
  });

  test('repetir los seeds no duplica nada', async () => {
    const tablas = ['service_orders', 'order_status_history', 'client_notices', 'maintenance', 'appointments', 'parts'];
    const antes = Object.fromEntries(await Promise.all(tablas.map(async (t) => [t, await count(t)])));

    await runSeeds(pool, () => {});

    const despues = Object.fromEntries(await Promise.all(tablas.map(async (t) => [t, await count(t)])));
    expect(despues).toEqual(antes);
  });
});
