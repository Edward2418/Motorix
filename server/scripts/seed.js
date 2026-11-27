import { pathToFileURL } from 'node:url';
import { pool, closePool } from '../config/db.js';
import { env } from '../config/env.js';
import { runSeeds } from './sqlRunner.js';
import { seedDatabase } from './demoSeed.js';

export { runSeeds };

// Uso: npm run db:seed (idempotente). En producción o con una base remota exige ALLOW_DEMO_DATA y DEMO_PASSWORD.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await seedDatabase(pool, {
      nodeEnv: env.nodeEnv,
      dbHost: env.db.host,
      allowDemoData: process.env.ALLOW_DEMO_DATA,
      demoPassword: process.env.DEMO_PASSWORD
    });
  } catch (error) {
    console.error('Error al ejecutar los seeds:', error.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
