'use strict';

const express = require('express');
const { httpError } = require('../errors');
const { asyncHandler, requireSession, loadDrive, csrfProtect, createRateLimiter } = require('./middleware');

function sendFileStream(res, result) {
  const fallback = String(result.name).replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  res.status(200);
  res.setHeader('Content-Type', result.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(result.name)}`);
  res.setHeader('Content-Length', String(result.sizeBytes));
  return (async () => {
    for await (const buf of result.stream()) {
      res.write(buf);
    }
    res.end();
  })();
}

function createShareRoutes({ config, repositories, sessionStore, fileService }) {
  const apiRouter = express.Router();
  const sRouter = express.Router();
  const auth = [requireSession(sessionStore), loadDrive(repositories)];
  const shareDownloadLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30 });

  // GET /api/shares/:token — public metadata for the share page.
  apiRouter.get(
    '/:token',
    asyncHandler(async (req, res) => {
      const meta = await fileService.readShare(req.params.token);
      res.json({
        name: meta.name,
        sizeBytes: meta.sizeBytes,
        mimeType: meta.mimeType,
        expiresAt: meta.expiresAt,
      });
    })
  );

  // DELETE /api/shares/:id — revoke an owned share.
  apiRouter.delete(
    '/:id',
    csrfProtect(config),
    auth,
    asyncHandler(async (req, res) => {
      const shareId = Number(req.params.id);
      if (!Number.isInteger(shareId)) throw httpError('NOT_FOUND');
      await fileService.revokeShare({ drive: req.drive, shareId });
      res.status(204).end();
    })
  );

  // GET /s/:token — public read-only file stream.
  sRouter.get(
    '/:token',
    shareDownloadLimiter,
    asyncHandler(async (req, res) => {
      const result = await fileService.streamShareFile(req.params.token);
      await sendFileStream(res, result);
    })
  );

  return { apiRouter, sRouter };
}

module.exports = { createShareRoutes };
