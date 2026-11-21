import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { buildCorsOptions } from './config/cors.js';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';

// Construye la aplicación Express sin escuchar en un puerto (supertest la usa directamente).
export function createApp() {
  const app = express();
  // Cabeceras de seguridad en toda respuesta (también quita `x-powered-by`) y CORS solo para los orígenes permitidos.
  app.use(helmet());
  app.use(cors(buildCorsOptions(env.cors.origins)));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export default createApp();
