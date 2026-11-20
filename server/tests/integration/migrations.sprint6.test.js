import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pool, closePool } from '../helpers/db.js';
import { splitStatements, databaseDir } from '../../scripts/sqlRunner.js';

const ARCHIVO = '008_sprint6_notifications.sql';

const columna = async (tabla, nombre) => {
  const [filas] = await pool.query(
    `SELECT data_type AS dataType, column_type AS columnType, is_nullable AS isNullable
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tabla, nombre]
  );
  return filas[0] ?? null;
};

const llaveForanea = async (tabla, columnaOrigen) => {
  const [filas] = await pool.query(
    `SELECT k.referenced_table_name AS tablaReferida, r.delete_rule AS reglaBorrado
     FROM information_schema.key_column_usage k
     JOIN information_schema.referential_constraints r
       ON r.constraint_schema = k.constraint_schema AND r.constraint_name = k.constraint_name
     WHERE k.table_schema = DATABASE() AND k.table_name = ? AND k.column_name = ?
       AND k.referenced_table_name IS NOT NULL`,
    [tabla, columnaOrigen]
  );
  return filas[0] ?? null;
};

const indice = async (tabla, nombre) => {
  const [filas] = await pool.query(
    `SELECT column_name AS columna, non_unique AS noUnico, seq_in_index AS posicion
     FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?
     ORDER BY seq_in_index`,
    [tabla, nombre]
  );
  return filas;
};

afterAll(closePool);

describe('migración 008 del Sprint 6: notification_reads', () => {
  test('tiene las columnas con los tipos del modelo de datos', async () => {
    const usuario = await columna('notification_reads', 'user_id');
    const clave = await columna('notification_reads', 'notification_key');
    const gravedad = await columna('notification_reads', 'severity');
    const lectura = await columna('notification_reads', 'read_at');
    expect(usuario).not.toBeNull();
    expect(clave.columnType).toBe('varchar(60)');
    expect(gravedad.columnType).toBe('tinyint unsigned');
    expect(gravedad.isNullable).toBe('NO');
    expect(lectura.dataType).toBe('datetime');
  });

  test('la llave primaria es (user_id, notification_key)', async () => {
    const primaria = await indice('notification_reads', 'PRIMARY');
    expect(primaria.map((fila) => fila.columna)).toEqual(['user_id', 'notification_key']);
  });

  test('la llave foránea a users(id) es ON DELETE CASCADE', async () => {
    const fk = await llaveForanea('notification_reads', 'user_id');
    expect(fk.tablaReferida).toBe('users');
    expect(fk.reglaBorrado).toBe('CASCADE');
  });
});

describe('migración 008 del Sprint 6: client_notices', () => {
  test('reason es un ENUM con los cuatro motivos', async () => {
    const motivo = await columna('client_notices', 'reason');
    expect(motivo.columnType).toBe(
      "enum('ORDEN_TERMINADA','CITA_MANANA','MANTENIMIENTO_PROXIMO','MANTENIMIENTO_VENCIDO')"
    );
  });

  test('fact_key es VARCHAR(60) y note es VARCHAR(255) y admite NULL', async () => {
    const hecho = await columna('client_notices', 'fact_key');
    const nota = await columna('client_notices', 'note');
    expect(hecho.columnType).toBe('varchar(60)');
    expect(hecho.isNullable).toBe('NO');
    expect(nota.columnType).toBe('varchar(255)');
    expect(nota.isNullable).toBe('YES');
  });

  test('existe la restricción única (reason, fact_key)', async () => {
    const [filas] = await pool.query(
      `SELECT index_name AS nombre, non_unique AS noUnico, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columnas
       FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'client_notices'
       GROUP BY index_name, non_unique`
    );
    const unico = filas.find((fila) => fila.noUnico === 0 && fila.columnas === 'reason,fact_key');
    expect(unico).toBeDefined();
  });

  test('existe el índice idx_client_notices_client sobre client_id', async () => {
    const columnas = await indice('client_notices', 'idx_client_notices_client');
    expect(columnas.map((fila) => fila.columna)).toEqual(['client_id']);
  });

  test('las llaves foráneas a clients(id) y users(id) son ON DELETE RESTRICT', async () => {
    const cliente = await llaveForanea('client_notices', 'client_id');
    const usuario = await llaveForanea('client_notices', 'notified_by');
    expect(cliente.tablaReferida).toBe('clients');
    expect(cliente.reglaBorrado).toBe('RESTRICT');
    expect(usuario.tablaReferida).toBe('users');
    expect(usuario.reglaBorrado).toBe('RESTRICT');
  });
});

describe('archivo de la migración 008', () => {
  test('schema_migrations registra la migración', async () => {
    const [filas] = await pool.query('SELECT name FROM schema_migrations');
    expect(filas.map((fila) => fila.name)).toContain(ARCHIVO);
  });

  test('se puede ejecutar dos veces sin error', async () => {
    const sql = await readFile(path.join(databaseDir, 'migrations', ARCHIVO), 'utf8');
    const sentencias = splitStatements(sql);
    expect(sentencias.length).toBeGreaterThan(0);
    for (const sentencia of sentencias) {
      expect(sentencia).toMatch(/CREATE TABLE IF NOT EXISTS/i);
      await pool.query(sentencia);
      await pool.query(sentencia);
    }
  });

  test('no modifica ninguna tabla anterior', async () => {
    const sql = await readFile(path.join(databaseDir, 'migrations', ARCHIVO), 'utf8');
    expect(sql).not.toMatch(/ALTER\s+TABLE/i);
    expect(sql).not.toMatch(/DROP\s+/i);
  });
});
