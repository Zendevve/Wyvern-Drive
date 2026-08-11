'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const { toErrorBody } = require('../errors');
const { createRateLimiter } = require('./middleware');
const { createAuthRoutes } = require('./auth-routes');
const { createSetupStatusRoutes } = require('./setup-status');
const { createStorageRoutes } = require('./storage-routes');
const { createDriveRoutes } = require('./drive-routes');
const { createEntryRoutes, createFolderRoutes } = require('./entry-routes');
const { createFileRoutes } = require('./file-routes');
const { createShareRoutes } = require('./share-routes');
const { mountStatic } = require('./static');

/**
 * Compose the Express application.
 * deps: { config, db, repositories, sessionStore, oauth, discordStorage, fileService }
 */
function createApp(deps) {
  const { config } = deps;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);

  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));

  // CORS: only APP_ORIGIN is accepted, with credentials. Same-origin requests
  // are untouched (harmless no-op).
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      if (origin === config.appOrigin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
      }
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Mutation rate limit: every POST/PATCH/DELETE under /api (the auth redirect
  // is a GET and stays unlimited; public share metadata GETs are not limited).
  const mutationLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 60 });
  app.use('/api', (req, res, next) => {
    if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'DELETE') {
      mutationLimiter(req, res, next);
    } else {
      next();
    }
  });

  const authRoutes = createAuthRoutes(deps);
  const storageRoutes = createStorageRoutes(deps);
  const driveRoutes = createDriveRoutes(deps);
  const entryRoutes = createEntryRoutes(deps);
  const folderRoutes = createFolderRoutes(deps);
  const fileRoutes = createFileRoutes(deps);
  const { apiRouter: shareApiRouter, sRouter } = createShareRoutes(deps);

  // First-run status: read-only, mounted before auth/protected routes. In a
  // complete configuration it reports setupRequired: false with empty
  // diagnostics; the limited setup app mounts the same route with real data.
  app.use('/api/setup', createSetupStatusRoutes({ missing: [], invalid: [] }));
  app.use('/api/auth', authRoutes);
  app.use('/api/storage', storageRoutes);
  app.use('/api/drive', driveRoutes);
  app.use('/api/entries', entryRoutes);
  app.use('/api/folders', folderRoutes);
  app.use('/api/files', fileRoutes);
  app.use('/api/shares', shareApiRouter);
  app.use('/s', sRouter);

  // Static SPA serving must come after the API/share routes.
  mountStatic(app);

  // 404 for anything unmatched.
  app.use((req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  });

  // Error middleware: always { error: { code, message } }, never stack traces.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    const { status, body } = toErrorBody(err);
    res.status(status).json(body);
  });

  return app;
}

module.exports = { createApp };
