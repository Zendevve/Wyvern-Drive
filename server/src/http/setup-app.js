'use strict';

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { createSetupStatusRoutes } = require('./setup-status');
const { createSetupConfigRoutes } = require('./setup-config');
const { toErrorBody } = require('../errors');
const { mountStatic } = require('./static');

/**
 * Limited app for first-run setup mode. Serves the read-only setup status
 * endpoint, the authenticated credential-write route, and the production SPA;
 * every other route returns the standard JSON 404 so partial API behavior is
 * never exposed while configuration is incomplete. No database, OAuth, or
 * Discord client is initialized in this mode.
 */
function createSetupApp(deps) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  const { missing = [], invalid = [], setupToken, envFile, initialEnv } = deps;

  const buildDir = path.join(__dirname, '..', '..', '..', 'web', 'build');
  const indexHtml = path.join(buildDir, 'index.html');
  const hasBuild = fs.existsSync(indexHtml);

  app.use('/api/setup', createSetupStatusRoutes(deps));
  app.use('/api/setup', createSetupConfigRoutes({ setupToken, envFile, initialEnv, missing, invalid }));

  if (hasBuild) {
    mountStatic(app);
  }

  // 404 for anything unmatched. Without a production build, non-API GETs get
  // a clear message instead of a bare not-found.
  app.use((req, res) => {
    if (!hasBuild && req.method === 'GET' && !req.path.startsWith('/api/')) {
      res.status(404).json({
        error: {
          code: 'SETUP_BUILD_MISSING',
          message: 'Web client build not found. Run "npm run build" in web/ and restart the server.',
        },
      });
      return;
    }
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (res.headersSent) { res.destroy(); return; }
    const { status, body } = toErrorBody(err);
    res.status(status).json(body);
  });

  return app;
}

module.exports = { createSetupApp };
