import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';

// Construye la aplicación Express sin escuchar en un puerto (supertest la usa directamente).
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export default createApp();
