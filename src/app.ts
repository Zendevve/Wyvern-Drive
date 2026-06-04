import Fastify from 'fastify';

export function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: 'info' }
  });

  app.get('/status', async () => {
    return {
      status: 'OK',
      timestamp: new Date().toISOString()
    };
  });

  return app;
}
export type AppInstance = ReturnType<typeof buildApp>;
