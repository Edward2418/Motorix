import { pathToFileURL } from 'node:url';
import { pool, closePool } from '../config/db.js';
import { runMigrations } from './sqlRunner.js';

export { runMigrations };

// Uso: npm run db:migrate
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await runMigrations(pool);
  } catch (error) {
    console.error('Error al aplicar las migraciones:', error.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
