import { pool, resetTables, closePool } from '../helpers/db.js';
import { runSeeds } from '../../scripts/sqlRunner.js';
import { notificationService } from '../../services/notificationService.js';
import { listPending } from '../../services/clientNoticeService.js';

// SC-005: el centro de notificaciones carga en menos de 2 segundos con los datos de ejemplo. La medición con 2 000
// órdenes y 5 000 movimientos está en `scripts/measure-notifications.js` (sus tiempos van en el documento de calidad).
const LIMITE_MS = 2000;

beforeEach(async () => {
  await resetTables();
  await runSeeds(pool, () => {});
});
afterAll(closePool);

const medir = async (accion) => {
  const inicio = process.hrtime.bigint();
  const resultado = await accion();
  return { ms: Number(process.hrtime.bigint() - inicio) / 1e6, resultado };
};

const usuario = async (username) => (await pool.query('SELECT id, role FROM users WHERE username = ?', [username]))[0][0];

describe('rendimiento del centro de notificaciones (SC-005)', () => {
  test.each(['admin', 'recepcion', 'mecanico'])('el centro de %s carga en menos de 2 segundos', async (username) => {
    const { ms, resultado } = await medir(async () => notificationService.getCenter(await usuario(username)));

    expect(resultado.groups.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(LIMITE_MS);
  });

  test('el contador carga en menos de 2 segundos y coincide con el centro', async () => {
    const admin = await usuario('admin');

    const { ms, resultado } = await medir(() => notificationService.getUnreadCount(admin));

    expect(ms).toBeLessThan(LIMITE_MS);
    expect(resultado).toBe((await notificationService.getCenter(admin)).unread);
  });

  test('la lista de clientes por avisar carga en menos de 2 segundos', async () => {
    const { ms, resultado } = await medir(() => listPending());

    expect(resultado.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(LIMITE_MS);
  });
});
