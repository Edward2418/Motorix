import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const databaseDir = path.resolve(here, '../../database');

// Divide un script SQL en sentencias. Los scripts del proyecto no usan procedimientos
// almacenados ni punto y coma dentro de cadenas, por lo que basta con separar por ";".
export function splitStatements(sql) {
  const withoutComments = sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  return withoutComments
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

async function listSqlFiles(directory) {
  const entries = await readdir(directory);
  return entries.filter((name) => name.endsWith('.sql')).sort();
}

// Aplica en orden las migraciones pendientes y las registra en schema_migrations.
export async function runMigrations(pool, log = console.log) {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name       VARCHAR(255) NOT NULL,
       applied_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (name)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
  const [applied] = await pool.query('SELECT name FROM schema_migrations');
  const appliedNames = new Set(applied.map((row) => row.name));

  const directory = path.join(databaseDir, 'migrations');
  const executed = [];
  for (const file of await listSqlFiles(directory)) {
    if (appliedNames.has(file)) {
      continue;
    }
    const sql = await readFile(path.join(directory, file), 'utf8');
    for (const statement of splitStatements(sql)) {
      await pool.query(statement);
    }
    await pool.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
    executed.push(file);
    log(`Migración aplicada: ${file}`);
  }
  if (executed.length === 0) {
    log('No hay migraciones pendientes.');
  }
  return executed;
}

// Ejecuta en orden todos los seeds. Son idempotentes: se pueden repetir sin duplicar datos.
export async function runSeeds(pool, log = console.log) {
  const directory = path.join(databaseDir, 'seeds');
  const executed = [];
  for (const file of await listSqlFiles(directory)) {
    const sql = await readFile(path.join(directory, file), 'utf8');
    for (const statement of splitStatements(sql)) {
      await pool.query(statement);
    }
    executed.push(file);
    log(`Seed ejecutado: ${file}`);
  }
  return executed;
}
