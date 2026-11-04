import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pool, resetTables, closePool } from '../helpers/db.js';
import { runSeeds, splitStatements, databaseDir } from '../../scripts/sqlRunner.js';

const columna = async (tabla, nombre) => {
  const [filas] = await pool.query(
    `SELECT data_type AS dataType, column_type AS columnType, is_nullable AS isNullable
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tabla, nombre]
  );
  return filas[0] ?? null;
};

afterAll(closePool);

describe('migraciones del Sprint 5', () => {
  test('tickets.content existe, es JSON y admite NULL', async () => {
    const content = await columna('tickets', 'content');
    expect(content).not.toBeNull();
    expect(content.dataType).toBe('json');
    expect(content.isNullable).toBe('YES');
  });

  test('payments.order_total_at_creation existe, es DECIMAL(10,2) y admite NULL', async () => {
    const total = await columna('payments', 'order_total_at_creation');
    expect(total).not.toBeNull();
    expect(total.columnType).toBe('decimal(10,2)');
    expect(total.isNullable).toBe('YES');
  });

  test('schema_migrations registra las dos migraciones nuevas', async () => {
    const [filas] = await pool.query('SELECT name FROM schema_migrations');
    const nombres = filas.map((fila) => fila.name);
    expect(nombres).toContain('006_sprint5_ticket_content.sql');
    expect(nombres).toContain('007_sprint5_payment_order_total.sql');
  });

  test.each(['006_sprint5_ticket_content.sql', '007_sprint5_payment_order_total.sql'])(
    '%s tiene exactamente una sentencia, para poder repetirla tras un fallo',
    async (archivo) => {
      const sql = await readFile(path.join(databaseDir, 'migrations', archivo), 'utf8');
      expect(splitStatements(sql)).toHaveLength(1);
    }
  );

  test('los pagos y tickets sembrados antes del sprint tienen las columnas nuevas en NULL', async () => {
    await resetTables();
    await runSeeds(pool, () => {});
    const [pagos] = await pool.query('SELECT COUNT(*) AS total FROM payments WHERE order_total_at_creation IS NOT NULL');
    // Solo los tickets de los seeds 009 (TK-2026-0001 y TK-2026-0002): el seed del Sprint 5 agrega uno con contenido.
    const [tickets] = await pool.query(
      "SELECT COUNT(*) AS total FROM tickets WHERE folio IN ('TK-2026-0001', 'TK-2026-0002') AND content IS NOT NULL"
    );
    expect(pagos[0].total).toBe(0);
    expect(tickets[0].total).toBe(0);
  });
});
