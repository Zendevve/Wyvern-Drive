import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { authPlugin } from './plugins/auth';
import { authRoutes } from './routes/auth';
import { uploadRoutes } from './routes/upload';

export function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: 'info' }
  });

  app.register(multipart, {
    limits: {
      fileSize: 1024 * 1024 * 1024 * 10, // 10 GB limit for stream chunking
    }
  });

  app.register(authPlugin);
  app.register(authRoutes);
  app.register(uploadRoutes);

  app.get('/status', async () => {
    return {
      status: 'OK',
      timestamp: new Date().toISOString()
    };
  });

  return app;
}
export type AppInstance = ReturnType<typeof buildApp>;
