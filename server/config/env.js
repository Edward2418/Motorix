// Configuración del backend. Todo valor sensible proviene de variables de entorno.
// Las variables se cargan con `node --env-file` (ver scripts de package.json) o desde el entorno.
// En pruebas, tests/helpers/setupEnv.js carga ../.env.test antes de importar este módulo.

import { readPositiveInt } from '../utils/envNumbers.js';
import { parseAllowedOrigins } from './cors.js';
import { buildSsl } from './dbSsl.js';
import { readTimeZone } from './dbTimeZone.js';

const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET'];

const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  throw new Error(`Faltan variables de entorno obligatorias: ${missing.join(', ')}. Revisa el archivo .env.`);
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  // Proxies de confianza delante de la API (en un hosting suele ser 1). Sin valor no se confía en X-Forwarded-For.
  trustProxy: readPositiveInt(process.env.TRUST_PROXY, 0, 'TRUST_PROXY'),
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
    // TLS hacia una base en la nube (DB_SSL=true).
    ssl: buildSsl(process.env.DB_SSL),
    timeZone: readTimeZone(process.env.DB_TIME_ZONE)
  },
  // Orígenes de navegador permitidos (CORS), separados por comas. Sin valor solo rigen los orígenes locales.
  cors: {
    origins: parseAllowedOrigins(process.env.CORS_ORIGINS)
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h'
  },
  // Umbrales para marcar un mantenimiento como «Próximo»: días o kilómetros restantes (clarificación del Sprint 3).
  maintenance: {
    soonDays: readPositiveInt(process.env.MAINTENANCE_SOON_DAYS, 30, 'MAINTENANCE_SOON_DAYS'),
    soonKm: readPositiveInt(process.env.MAINTENANCE_SOON_KM, 1000, 'MAINTENANCE_SOON_KM')
  },
  // Pagos (Sprint 4). El token de Mercado Pago solo se lee del entorno: nunca se registra ni se envía al cliente.
  payments: {
    paymentLinkHours: readPositiveInt(process.env.PAYMENT_LINK_HOURS, 24, 'PAYMENT_LINK_HOURS')
  },
  mercadoPago: {
    accessToken: (process.env.MERCADOPAGO_ACCESS_TOKEN ?? '').trim(),
    backUrl: (process.env.MERCADOPAGO_BACK_URL ?? '').trim(),
    // Enlace de pruebas (sandbox) por defecto; poner MERCADOPAGO_SANDBOX=false para usar el enlace de producción.
    sandbox: (process.env.MERCADOPAGO_SANDBOX ?? 'true').trim().toLowerCase() !== 'false'
  },
  // Encabezado del ticket. Valores de ejemplo: se cambian en .env, no hay pantalla para editarlos.
  workshop: {
    name: (process.env.WORKSHOP_NAME ?? 'Taller Motorix (ejemplo)').trim(),
    address: (process.env.WORKSHOP_ADDRESS ?? 'Av. Principal 123, Ciudad de México').trim(),
    phone: (process.env.WORKSHOP_PHONE ?? '55 0000 0000').trim()
  }
};
