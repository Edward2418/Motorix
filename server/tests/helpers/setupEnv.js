// Se ejecuta antes de cada archivo de pruebas: carga el entorno de pruebas (.env.test)
// y valores por defecto para las pruebas unitarias que no tocan la base de datos.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const envFile = path.join(root, '.env.test');

process.env.NODE_ENV = 'test';
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

process.env.DB_HOST ??= 'localhost';
process.env.DB_PORT ??= '3306';
process.env.DB_USER ??= 'motorix_app';
process.env.DB_PASSWORD ??= 'sin-configurar';
process.env.DB_NAME ??= 'motorix_test';
process.env.JWT_SECRET ??= 'secreto-solo-para-pruebas';
process.env.JWT_EXPIRES_IN ??= '1h';
