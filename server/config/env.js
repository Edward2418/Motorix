// Configuración del backend. Todo valor sensible proviene de variables de entorno.
// Las variables se cargan con `node --env-file` (ver scripts de package.json) o desde el entorno.
// En pruebas, tests/helpers/setupEnv.js carga ../.env.test antes de importar este módulo.

import { readPositiveInt } from '../utils/envNumbers.js';

const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET'];

const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  throw new Error(`Faltan variables de entorno obligatorias: ${missing.join(', ')}. Revisa el archivo .env.`);
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h'
  },
  // Umbrales para marcar un mantenimiento como «Próximo»: días o kilómetros restantes (clarificación del Sprint 3).
  maintenance: {
    soonDays: readPositiveInt(process.env.MAINTENANCE_SOON_DAYS, 30, 'MAINTENANCE_SOON_DAYS'),
    soonKm: readPositiveInt(process.env.MAINTENANCE_SOON_KM, 1000, 'MAINTENANCE_SOON_KM')
  }
};
