import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { databaseDir, runSeeds } from './sqlRunner.js';
import { hashPassword } from '../utils/hash.js';
import { passwordProblems } from '../validators/authValidator.js';

// Carga de los datos de ejemplo con protección para producción. Las contraseñas de las cuentas de ejemplo están
// publicadas en el repositorio: en una base remota o en producción solo se cargan con permiso explícito y sustituyendo
// esas contraseñas por una propia.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const BCRYPT_HASH = /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/g;

/** Es de producción si el entorno lo dice o si la base no está en este equipo. */
export function isProtectedDatabase({ nodeEnv, dbHost }) {
  return nodeEnv === 'production' || !LOCAL_HOSTS.has(String(dbHost ?? '').trim().toLowerCase());
}

// Los hashes de las contraseñas publicadas: los que aparecen escritos en los seeds.
async function publishedHashes() {
  const directory = path.join(databaseDir, 'seeds');
  const hashes = new Set();
  for (const file of await readdir(directory)) {
    const sql = await readFile(path.join(directory, file), 'utf8');
    for (const hash of sql.match(BCRYPT_HASH) ?? []) {
      hashes.add(hash);
    }
  }
  return [...hashes];
}

/** Ejecuta los seeds. En una base protegida exige `allowDemoData === 'true'` y una `demoPassword` que cumpla la política. */
export async function seedDatabase(pool, { nodeEnv, dbHost, allowDemoData, demoPassword, log = console.log } = {}) {
  if (!isProtectedDatabase({ nodeEnv, dbHost })) {
    return runSeeds(pool, log);
  }
  if (allowDemoData !== 'true') {
    throw new Error(
      'Esta base es de producción o remota y los datos de ejemplo tienen contraseñas publicadas. Para cargarlos define ALLOW_DEMO_DATA=true y DEMO_PASSWORD con una contraseña propia.'
    );
  }
  if (typeof demoPassword !== 'string' || passwordProblems(demoPassword).length > 0) {
    throw new Error('DEMO_PASSWORD es obligatoria y debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.');
  }
  const passwordHash = await hashPassword(demoPassword);
  const hashes = await publishedHashes();
  const executed = await runSeeds(pool, log);
  // Solo cambia las cuentas que siguen con una contraseña publicada: no pisa las que alguien ya cambió.
  const [result] = await pool.query('UPDATE users SET password_hash = ? WHERE password_hash IN (?)', [passwordHash, hashes]);
  log(`Contraseñas de ejemplo sustituidas por DEMO_PASSWORD en ${result.affectedRows} cuentas.`);
  return executed;
}
