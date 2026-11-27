import { pool, resetTables, closePool, createClient, createUser } from '../helpers/db.js';
import { withTransaction, query } from '../../config/db.js';

// Los pagos, tickets, folios e inventario bloquean una fila con FOR UPDATE y después leen. La lectura posterior al bloqueo
// debe ver lo que confirmó quien lo tenía antes. MySQL lo cumple con su aislamiento por omisión, pero TiDB fija la «foto»
// al iniciar la transacción: por eso las transacciones usan READ COMMITTED.
beforeEach(resetTables);
afterAll(closePool);

const pausa = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('tras esperar un bloqueo, la transacción ve lo que confirmó la anterior', async () => {
  const usuario = await createUser({ username: 'candado', role: 'ADMIN' });
  const bloquear = (conn) => query('SELECT id FROM users WHERE id = ? FOR UPDATE', [usuario.id], conn);
  let avisar;
  const primeraTieneElBloqueo = new Promise((resolve) => {
    avisar = resolve;
  });

  const primera = withTransaction(async (conn) => {
    await bloquear(conn);
    avisar();
    await pausa(1500);
    await conn.query("INSERT INTO clients (name, phone) VALUES ('Guardado por la primera', '5550000000')");
  });
  await primeraTieneElBloqueo;
  const segunda = withTransaction(async (conn) => {
    await bloquear(conn);
    const [fila] = await query('SELECT COUNT(*) AS total FROM clients', [], conn);
    return Number(fila.total);
  });

  await primera;
  expect(await segunda).toBe(1);
});

test('una transacción que falla no deja nada guardado', async () => {
  await createClient({ name: 'Previo' });

  await expect(
    withTransaction(async (conn) => {
      await conn.query("INSERT INTO clients (name, phone) VALUES ('Se revierte', '5550000001')");
      throw new Error('fallo a propósito');
    })
  ).rejects.toThrow('fallo a propósito');

  const [[fila]] = await pool.query('SELECT COUNT(*) AS total FROM clients');
  expect(Number(fila.total)).toBe(1);
});
