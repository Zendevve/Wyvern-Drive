'use strict';

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

/**
 * Serve the production web build (../web/build) when present. Must be mounted
 * AFTER the /api and /s routes so it never shadows the API; the SPA fallback
 * only answers non-API, non-share GET paths.
 */
function mountStatic(app) {
  const buildDir = path.join(__dirname, '..', '..', '..', 'web', 'build');
  const indexHtml = path.join(buildDir, 'index.html');
  if (!fs.existsSync(indexHtml)) return;

  app.use(express.static(buildDir));
  app.get(/^\/(?!api\/|s\/).*/, (req, res) => {
    res.sendFile(indexHtml);
  });
}

module.exports = { mountStatic };
