import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { authPlugin } from './plugins/auth';
import { authRoutes } from './routes/auth';
import { uploadRoutes } from './routes/upload';
import { downloadRoutes } from './routes/download';
import { deleteRoutes } from './routes/delete';
import { fsRoutes } from './routes/fs';
import { openDatabase, type DB } from './db/database';

export interface AppOptions {
  db?: DB;
}

export function buildApp(opts: AppOptions = {}) {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: 'info' }
  });

  const db = opts.db || openDatabase();

  app.decorate('db', db);
  app.addHook('onClose', async () => {
    db.close();
  });

  app.register(multipart, {
    limits: {
      fileSize: 1024 * 1024 * 1024 * 10, // 10 GB limit for stream chunking
    }
  });

  app.register(authPlugin);
  app.register(authRoutes);
  app.register(uploadRoutes);
  app.register(downloadRoutes);
  app.register(deleteRoutes);
  app.register(fsRoutes);

  app.get('/status', async () => {
    return {
      status: 'OK',
      timestamp: new Date().toISOString()
    };
  });

  return app;
}
export type AppInstance = ReturnType<typeof buildApp>;

declare module 'fastify' {
  interface FastifyInstance {
    db: DB;
  }
}
