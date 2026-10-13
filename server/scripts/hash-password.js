// Genera un hash bcrypt (costo 10) a partir de la contraseña indicada.
// Solo sirve para producir los hashes que van en database/seeds/. Uso:
//   node scripts/hash-password.js "<contraseña>"
import { hashPassword } from '../utils/hash.js';

const password = process.argv[2];
if (!password) {
  console.error('Uso: node scripts/hash-password.js "<contraseña>"');
  process.exit(1);
}
console.log(await hashPassword(password));
