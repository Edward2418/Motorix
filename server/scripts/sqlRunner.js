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

// Separa por las comas de primer nivel: ignora las que van entre paréntesis o dentro de comillas.
function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let current = '';
  for (const char of text) {
    if (quote) {
      quote = char === quote ? null : quote;
    } else if (char === "'" || char === '"' || char === '`') {
      quote = char;
    } else if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
    } else if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current.trim());
  return parts;
}

// TiDB no admite un CHECK sobre una columna que además participa en una llave foránea de la misma tabla. Esas reglas
// se omiten allí (la API las valida); en MySQL se crean como siempre.
function withoutUnsupportedChecks(statement) {
  const match = /^(CREATE\s+TABLE[^(]*\()([\s\S]*)(\)[^)]*)$/i.exec(statement);
  if (!match) {
    return statement;
  }
  const [, head, body, tail] = match;
  const clauses = splitTopLevel(body);
  const foreignColumns = clauses.flatMap((clause) => {
    const key = /FOREIGN\s+KEY\s*\(([^)]*)\)/i.exec(clause);
    return key ? key[1].split(',').map((column) => column.trim()) : [];
  });
  const supported = clauses.filter((clause) => {
    const check = /^CONSTRAINT\s+\S+\s+CHECK\s*([\s\S]*)$/i.exec(clause);
    return !check || !foreignColumns.some((column) => new RegExp(`\\b${column}\\b`).test(check[1]));
  });
  return supported.length === clauses.length ? statement : `${head}\n  ${supported.join(',\n  ')}\n${tail}`;
}

/**
 * Adapta una sentencia a TiDB: quita los CHECK que no admite y, como no resuelve dentro de un mismo `ALTER TABLE` una
 * columna agregada en esa sentencia, convierte un `ALTER TABLE` con varios `ADD` en uno por cláusula, en el mismo
 * orden. El resto no cambia.
 */
export function forTiDB(statement) {
  if (/^CREATE\s+TABLE/i.test(statement)) {
    return [withoutUnsupportedChecks(statement)];
  }
  const match = /^ALTER\s+TABLE\s+(\S+)\s+([\s\S]+)$/i.exec(statement);
  if (!match) {
    return [statement];
  }
  const [, table, body] = match;
  const clauses = splitTopLevel(body);
  if (clauses.length < 2 || !clauses.every((clause) => /^ADD\s/i.test(clause))) {
    return [statement];
  }
  return clauses.map((clause) => `ALTER TABLE ${table} ${clause}`);
}

async function isTiDB(pool) {
  const [[row]] = await pool.query('SELECT VERSION() AS version');
  return row.version.includes('TiDB');
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

  const tidb = await isTiDB(pool);
  if (tidb) {
    // TiDB ignora las restricciones CHECK salvo que se activen, y debe hacerse antes de crear las tablas.
    await pool.query('SET GLOBAL tidb_enable_check_constraint = ON');
  }

  const directory = path.join(databaseDir, 'migrations');
  const executed = [];
  for (const file of await listSqlFiles(directory)) {
    if (appliedNames.has(file)) {
      continue;
    }
    const sql = await readFile(path.join(directory, file), 'utf8');
    for (const statement of splitStatements(sql).flatMap((s) => (tidb ? forTiDB(s) : [s]))) {
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
