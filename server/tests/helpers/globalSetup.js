// Se ejecuta una vez antes de todas las pruebas: deja el esquema de motorix_test al día.
// Si la base de pruebas no está disponible, las pruebas de integración fallan con un mensaje claro
// y las unitarias siguen funcionando.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default async function globalSetup() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const envFile = path.join(root, '.env.test');
  if (!existsSync(envFile)) {
    console.warn('\n[pruebas] No existe .env.test: se omiten las migraciones de motorix_test.');
    return;
  }
  process.loadEnvFile(envFile);
  process.env.NODE_ENV = 'test';

  const { pool, closePool } = await import('../../config/db.js');
  const { runMigrations } = await import('../../scripts/sqlRunner.js');
  try {
    await runMigrations(pool, () => {});
  } catch (error) {
    console.warn(`\n[pruebas] No se pudo preparar motorix_test: ${error.message}`);
  } finally {
    await closePool();
  }
}
