import Fastify from 'fastify';
import { authPlugin } from './plugins/auth';
import { authRoutes } from './routes/auth';

export function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: 'info' }
  });

  app.register(authPlugin);
  app.register(authRoutes);

  app.get('/status', async () => {
    return {
      status: 'OK',
      timestamp: new Date().toISOString()
    };
  });

  return app;
}
export type AppInstance = ReturnType<typeof buildApp>;
