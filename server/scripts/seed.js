import { pathToFileURL } from 'node:url';
import { pool, closePool } from '../config/db.js';
import { runSeeds } from './sqlRunner.js';

export { runSeeds };

// Uso: npm run db:seed (idempotente)
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await runSeeds(pool);
  } catch (error) {
    console.error('Error al ejecutar los seeds:', error.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
