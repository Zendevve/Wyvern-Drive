'use strict';

const express = require('express');
const { asyncHandler, requireSession, loadDrive, csrfProtect } = require('./middleware');
const { httpError } = require('../errors');

/**
 * Trash routes: soft-deleted entries (deleted_at set, status unchanged).
 * GET performs a lazy retention sweep before listing; restore clears
 * deleted_at on the subtree; DELETE purges the entry for good (Discord
 * messages reclaimed when their blocks lose their last live reference).
 */
function createTrashRoutes({ config, repositories, sessionStore, fileService }) {
  const router = express.Router();
  const auth = [requireSession(sessionStore), loadDrive(repositories)];

  router.get(
    '/',
    auth,
    asyncHandler(async (req, res) => {
      await fileService.purgeExpiredTrash({ drive: req.drive });
      const result = await fileService.listTrash({ drive: req.drive });
      res.json(result);
    })
  );

  router.post(
    '/:id/restore',
    csrfProtect(config),
    auth,
    asyncHandler(async (req, res) => {
      const entryId = Number(req.params.id);
      if (!Number.isInteger(entryId)) throw httpError('NOT_FOUND');
      const entry = await fileService.restoreEntry({ drive: req.drive, entryId });
      res.json(entry);
    })
  );

  router.delete(
    '/:id',
    csrfProtect(config),
    auth,
    asyncHandler(async (req, res) => {
      const entryId = Number(req.params.id);
      if (!Number.isInteger(entryId)) throw httpError('NOT_FOUND');
      await fileService.purgeEntry({ drive: req.drive, entryId });
      res.status(204).end();
    })
  );

  return router;
}

module.exports = { createTrashRoutes };
